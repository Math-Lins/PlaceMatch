const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

let _on401: (() => void) | null = null;
export function setOn401(cb: () => void): void {
  _on401 = cb;
}

export const MSG_FALHA = 'Não foi possível concluir a operação. Tente novamente em instantes.';
export const MSG_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.';

const ROTA_LOGIN = '/api/auth/login/';
const ROTA_REFRESH = '/api/auth/login/refresh/';

function getToken(): string | null {
  return sessionStorage.getItem('pm_access');
}

function getRefreshToken(): string | null {
  return sessionStorage.getItem('pm_refresh');
}

function setTokens(access: string, refresh: string): void {
  sessionStorage.setItem('pm_access', access);
  sessionStorage.setItem('pm_refresh', refresh);
}

// Tudo o que é da pessoa logada e fica na aba: tokens, busca/filtros da Descoberta e o marco das notificações.
// Sair da conta (ou perder a sessão) apaga tudo, para a próxima pessoa não herdar o estado da anterior.
const CHAVES_DA_SESSAO = ['pm_access', 'pm_refresh', 'pm_disc_q', 'pm_disc_filters', 'pm_notif_last_visit'];

export function logout(): void {
  for (const chave of CHAVES_DA_SESSAO) sessionStorage.removeItem(chave);
}

/**
 * Sair da conta: limpa a sessão da aba na hora e avisa a API para bloquear o refresh
 * (POST /api/auth/logout/). Se o aviso falhar, a pessoa sai do mesmo jeito.
 */
export function sairDaConta(): void {
  const refresh = getRefreshToken();
  logout();
  if (!refresh) return;
  fetch(`${BASE}/api/auth/logout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
    keepalive: true,
  }).catch(() => { /* sem rede: o refresh só vai expirar sozinho */ });
}

export class ApiError extends Error {
  fieldErrors: Record<string, string>;
  /** Status HTTP da resposta (undefined quando nem chegou resposta, ex.: sem rede). */
  status?: number;
  constructor(message: string, fieldErrors: Record<string, string> = {}, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

/** A API recusou a curtida/recusa porque o perfil não está mais disponível (já avaliado, suspenso...): 400 ou 404. */
export function perfilIndisponivel(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 400 || e.status === 404);
}

/** Extrai a primeira mensagem de texto de um erro do DRF (string, lista ou objeto aninhado). */
function primeiraMensagem(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    for (const item of val) {
      const m = primeiraMensagem(item);
      if (m) return m;
    }
    return '';
  }
  if (val && typeof val === 'object') {
    for (const item of Object.values(val as Record<string, unknown>)) {
      const m = primeiraMensagem(item);
      if (m) return m;
    }
    return '';
  }
  return val == null ? '' : String(val);
}

type ResultadoRefresh = 'ok' | 'invalido' | 'rede';
let _refreshEmAndamento: Promise<ResultadoRefresh> | null = null;

async function executarRefresh(): Promise<ResultadoRefresh> {
  const refresh = getRefreshToken();
  if (!refresh) return 'invalido';
  try {
    const res = await fetch(`${BASE}${ROTA_REFRESH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (res.status >= 500) return 'rede';
    if (!res.ok) return 'invalido';
    const body = (await res.json().catch(() => ({}))) as { access?: string; refresh?: string };
    if (!body.access) return 'invalido';
    // O backend rotaciona o refresh (ROTATE_REFRESH_TOKENS): guarda o novo, se vier.
    setTokens(body.access, body.refresh ?? refresh);
    return 'ok';
  } catch {
    return 'rede';
  }
}

/** Uma única renovação por vez: chamadas simultâneas compartilham a mesma promessa. */
function renovarToken(): Promise<ResultadoRefresh> {
  if (!_refreshEmAndamento) {
    _refreshEmAndamento = executarRefresh().finally(() => {
      _refreshEmAndamento = null;
    });
  }
  return _refreshEmAndamento;
}

function encerrarSessao(): never {
  logout();
  _on401?.();
  throw new ApiError(MSG_SESSAO_EXPIRADA);
}

/**
 * fetch autenticado. Em 401 (fora das rotas de login/refresh) tenta renovar o access uma
 * única vez e repete a requisição; se não der, limpa a sessão e leva ao login.
 */
async function fetchComAuth(path: string, options: RequestInit = {}, comJson = true): Promise<Response> {
  const enviar = (): Promise<Response> => {
    const token = getToken();
    const headers: Record<string, string> = {
      ...(comJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetch(`${BASE}${path}`, { ...options, headers });
  };

  const tokenEnviado = getToken();
  let res: Response;
  try {
    res = await enviar();
  } catch {
    throw new ApiError(MSG_FALHA);
  }

  if (res.status !== 401 || path === ROTA_LOGIN || path === ROTA_REFRESH) return res;

  // 401 em rota autenticada: tenta renovar uma vez.
  const tokenAtual = getToken();
  if (!tokenAtual && !getRefreshToken()) return encerrarSessao();

  if (tokenAtual && tokenAtual !== tokenEnviado) {
    // outra requisição já renovou o token enquanto esta estava em voo: só repete
  } else {
    const r = await renovarToken();
    if (r === 'rede') throw new ApiError(MSG_FALHA);
    if (r === 'invalido') return encerrarSessao();
  }

  try {
    res = await enviar();
  } catch {
    throw new ApiError(MSG_FALHA);
  }
  if (res.status === 401) return encerrarSessao();
  return res;
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchComAuth(path, options);

  if (res.status === 204) return {} as T;
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // só chega aqui na rota de login (credenciais erradas ou conta suspensa)
    const detail = (body as Record<string, string>)?.detail ?? '';
    throw new ApiError(detail || 'E-mail ou senha incorretos.', {}, 401);
  }

  if (res.status >= 500) throw new ApiError(MSG_FALHA, {}, res.status);

  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    let firstMsg = '';

    if (body && typeof body === 'object') {
      for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
        const msg = primeiraMensagem(val);
        if (!msg) continue;
        if (!firstMsg) firstMsg = msg;
        if (key !== 'detail' && key !== 'non_field_errors') {
          fieldErrors[key] = msg;
        }
      }
    }

    const detail = primeiraMensagem((body as Record<string, unknown>)?.detail);
    const naoCampo = primeiraMensagem((body as Record<string, unknown>)?.non_field_errors);
    const msg =
      detail ||
      naoCampo ||
      firstMsg ||
      (res.status === 404 ? 'Recurso não encontrado.' : MSG_FALHA);
    throw new ApiError(String(msg), fieldErrors, res.status);
  }

  return body as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface RegistrarDados {
  username: string;
  email: string;
  password: string;
  tipo: 'buscando_vaga' | 'oferecendo_vaga';
}

export interface Usuario {
  id: number;
  username: string;
  nome?: string;
  email: string;
  tipo: string;
}

export async function registrar(dados: RegistrarDados): Promise<void> {
  await req('/api/auth/registrar/', { method: 'POST', body: JSON.stringify(dados) });
}

export async function login(email: string, password: string): Promise<void> {
  const res = await req<{ access: string; refresh: string }>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(res.access, res.refresh);
}

/** Pede o link de redefinição por e-mail. A resposta é sempre a mesma (exista a conta ou não). */
export async function solicitarRedefinicaoSenha(email: string): Promise<string> {
  const r = await req<{ detail: string }>('/api/auth/senha/solicitar/', { method: 'POST', body: JSON.stringify({ email }) });
  return r.detail;
}

/** Troca a senha com o `uid` e o `token` do link do e-mail. Encerra todas as sessões abertas da conta. */
export async function redefinirSenha(uid: string, token: string, nova_senha: string): Promise<string> {
  const r = await req<{ detail: string }>('/api/auth/senha/redefinir/', { method: 'POST', body: JSON.stringify({ uid, token, nova_senha }) });
  return r.detail;
}

export async function buscarMeuUsuario(): Promise<Usuario> {
  return req<Usuario>('/api/auth/me/');
}

// ─── Perfis ────────────────────────────────────────────────────────────────────

export interface PerfilPayload {
  nome: string;
  idade: number;
  orcamento_min: number;
  orcamento_max: number;
  regiao: string;
  fumante: boolean;
  aceita_pets: boolean;
  tolerancia_bagunca: number;
  nivel_organizacao: number;
  bio: string;
  perfil_horario: 'madrugador' | 'noturno' | 'flexivel';
  nivel_ruido: number;
  nivel_social: number;
  aceita_visitas: 'raramente' | 'as_vezes' | 'frequentemente';
  tipo_imovel: 'apartamento' | 'casa' | 'republica' | 'indiferente';
  qtd_moradores: number;
  // Anúncio (apenas oferecendo_vaga)
  titulo_anuncio?: string;
  descricao_imovel?: string;
  fotos_imovel?: string[];
  foto_perfil_url?: string;
}

/** Tema de convivência detectado pela IA numa bio (ex.: {id: 'culinaria', nome: 'Culinária'}). */
export interface Tema {
  id: string;
  nome: string;
}

/** O que a IA entendeu da bio do próprio usuário (só vem no PRÓPRIO perfil). */
export interface AnaliseIA {
  situacao: 'analisada' | 'bio_curta' | 'pendente' | 'ia_desligada';
  temas: Tema[];
  caracteres_uteis: number;
  minimo_caracteres: number;
}

export interface Perfil extends PerfilPayload {
  id: number;
  usuario: number;
  analise_ia?: AnaliseIA | null;
}

export async function listarPerfis(): Promise<Perfil[]> {
  return req<Perfil[]>('/api/perfis/');
}

export async function criarPerfil(dados: PerfilPayload): Promise<Perfil> {
  return req<Perfil>('/api/perfis/', { method: 'POST', body: JSON.stringify(dados) });
}

export async function atualizarPerfil(id: number, dados: Partial<PerfilPayload>): Promise<Perfil> {
  return req<Perfil>(`/api/perfis/${id}/`, { method: 'PATCH', body: JSON.stringify(dados) });
}

export async function excluirPerfil(id: number): Promise<void> {
  await req<void>(`/api/perfis/${id}/`, { method: 'DELETE' });
}

// ─── Descoberta / Matches ──────────────────────────────────────────────────────

export interface PerfilDescoberto {
  id: number;
  nome: string;
  idade: number;
  regiao: string;
  bio: string;
  orcamento_min: string;
  orcamento_max: string;
  fumante: boolean;
  aceita_pets: boolean;
  tolerancia_bagunca: number;
  nivel_organizacao: number;
  perfil_horario: 'madrugador' | 'noturno' | 'flexivel';
  nivel_ruido: number;
  nivel_social: number;
  aceita_visitas: 'raramente' | 'as_vezes' | 'frequentemente';
  tipo_imovel: 'apartamento' | 'casa' | 'republica' | 'indiferente';
  qtd_moradores: number;
  score: number;
  usuario_id: number;
  tipo?: 'buscando_vaga' | 'oferecendo_vaga';
  titulo_anuncio?: string | null;
  descricao_imovel?: string | null;
  fotos_imovel?: string[];
  foto_perfil_url?: string | null;
  /** Afinidade por IA entre as bios (0 a 1); null sem bio suficiente ou com a IA desligada. */
  afinidade_ia?: number | null;
  temas_em_comum?: Tema[];
}

export interface PerfilBasico {
  id: number;
  nome: string;
  idade: number;
  regiao: string;
  bio: string;
  fumante: boolean;
  aceita_pets: boolean;
  tolerancia_bagunca: number;
  nivel_organizacao: number;
  orcamento_min: string;
  orcamento_max: string;
  perfil_horario: 'madrugador' | 'noturno' | 'flexivel';
  nivel_ruido: number;
  nivel_social: number;
  aceita_visitas: 'raramente' | 'as_vezes' | 'frequentemente';
  tipo_imovel: 'apartamento' | 'casa' | 'republica' | 'indiferente';
  qtd_moradores: number;
  usuario_id: number;
  tipo?: 'buscando_vaga' | 'oferecendo_vaga';
  titulo_anuncio?: string | null;
  descricao_imovel?: string | null;
  fotos_imovel?: string[];
  foto_perfil_url?: string | null;
}

export interface MatchData {
  id: number;
  perfil_a: PerfilBasico;
  perfil_b: PerfilBasico;
  score: number;
  data_match: string;
}

export interface CurtidaResponse {
  match: boolean;
  match_data?: MatchData;
}

export interface DescobertaParams {
  q?: string;
  regiao?: string[];
  tipo_imovel?: string;
  aceita_pets?: 'sim' | 'nao' | 'indiferente';
  fumante?: 'sim' | 'nao' | 'indiferente';
  orcamento_min?: number;
  orcamento_max?: number;
  score_min?: number;
  ordenar?: 'compatibilidade' | 'menor_preco' | 'maior_preco';
}

// A tela usa sim/não/indiferente e nomes de ordenação próprios; a API espera true/false e score/orcamento_*.
const BOOL_API: Record<string, string> = { sim: 'true', nao: 'false' };
const ORDEM_API: Record<string, string> = { compatibilidade: 'score', menor_preco: 'orcamento_asc', maior_preco: 'orcamento_desc' };

export async function listarDescoberta(params?: DescobertaParams): Promise<PerfilDescoberto[]> {
  const paraApi: Record<string, unknown> = { ...(params ?? {}) };
  if (params?.aceita_pets) paraApi.aceita_pets = BOOL_API[params.aceita_pets];
  if (params?.fumante) paraApi.fumante = BOOL_API[params.fumante];
  if (params?.ordenar) paraApi.ordenar = ORDEM_API[params.ordenar];
  const qs = params ? buildQS(paraApi) : '';
  return req<PerfilDescoberto[]>(`/api/descoberta/${qs}`);
}

export async function enviarCurtida(
  perfil_destino: number,
  tipo: 'curtir' | 'recusar',
): Promise<CurtidaResponse> {
  return req<CurtidaResponse>('/api/curtidas/', {
    method: 'POST',
    body: JSON.stringify({ perfil_destino, tipo }),
  });
}

export async function listarMatches(): Promise<MatchData[]> {
  return req<MatchData[]>('/api/matches/');
}

// ─── Chat ──────────────────────────────────────────────────────────────────────

export interface UltimaMensagem {
  conteudo: string;
  data_envio: string;
  remetente_id: number;
}

export interface Conversa {
  match_id: number;
  outro_perfil: {
    id: number; usuario_id: number; nome: string; idade: number; regiao: string;
    tipo?: string; titulo_anuncio?: string | null; fotos_imovel?: string[] | null; foto_perfil_url?: string | null;
  };
  score: number;
  ultima_mensagem: UltimaMensagem | null;
  nao_lidas: number;
}

export interface MensagemAPI {
  id: number;
  match_id: number;
  remetente_id: number;
  conteudo: string;
  data_envio: string;
  lida: boolean;
}

export interface ConversasParams {
  q?: string;
  nao_lidas?: boolean;
}

export async function listarConversas(params?: ConversasParams): Promise<Conversa[]> {
  const qs = params ? buildQS(params as Record<string, unknown>) : '';
  return req<Conversa[]>(`/api/conversas/${qs}`);
}

export async function listarMensagens(matchId: number, apos?: number): Promise<MensagemAPI[]> {
  const qs = apos !== undefined ? `?apos=${apos}` : '';
  return req<MensagemAPI[]>(`/api/matches/${matchId}/mensagens/${qs}`);
}

export async function enviarMensagem(matchId: number, conteudo: string): Promise<MensagemAPI> {
  return req<MensagemAPI>(`/api/matches/${matchId}/mensagens/`, {
    method: 'POST',
    body: JSON.stringify({ conteudo }),
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function buildQS(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === '') continue;
    if (Array.isArray(val)) {
      val.forEach((v) => qs.append(key, String(v)));
    } else {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

// ─── Admin ────────────────────────────────────────────────────────────────────

/** Valida o período (datas AAAA-MM-DD) no cliente. Retorna a mensagem de erro, ou '' se ok. */
export function validarPeriodo(inicio?: string, fim?: string): string {
  if (inicio && fim && inicio > fim) return 'A data inicial não pode ser maior que a data final.';
  // Mesmas regras da API: datas a partir de 01/01/2000 e período de até 366 dias.
  if ((inicio && inicio < '2000-01-01') || (fim && fim < '2000-01-01')) return 'As datas devem ser a partir de 01/01/2000.';
  if (inicio && fim) {
    const dias = (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000 + 1;
    if (dias > 366) return 'O período não pode passar de 366 dias. Reduza o intervalo entre as datas.';
  }
  return '';
}

export interface PaginatedResponse<T> {
  count: number;
  page: number;
  results: T[];
}

export interface LogEntry {
  id: number;
  data_hora: string;
  usuario: { id: number; nome: string; email: string } | null;
  acao: string;
  acao_label: string;
  entidade: string;
  entidade_id: number | null;
  detalhes: Record<string, unknown>;
  ip: string | null;
}

export interface UsuarioAdmin {
  id: number;
  nome: string;
  email: string;
  tipo: string;
  regiao: string | null;
  data_cadastro: string;
  tem_perfil: boolean;
  ativo: boolean;
}

export interface LogsParams {
  acao?: string;
  usuario?: string;
  entidade?: string;
  data_inicio?: string;
  data_fim?: string;
  page?: number;
}

export interface AdminUsuariosParams {
  q?: string;
  tipo?: string;
  regiao?: string;
  ativo?: string;
  data_inicio?: string;
  data_fim?: string;
  page?: number;
}

export async function listarLogs(
  params?: LogsParams,
): Promise<PaginatedResponse<LogEntry>> {
  const qs = params ? buildQS(params as Record<string, unknown>) : '';
  return req<PaginatedResponse<LogEntry>>(`/api/admin/logs/${qs}`);
}

export async function listarAdminUsuarios(
  params?: AdminUsuariosParams,
): Promise<PaginatedResponse<UsuarioAdmin>> {
  const qs = params ? buildQS(params as Record<string, unknown>) : '';
  return req<PaginatedResponse<UsuarioAdmin>>(`/api/admin/usuarios/${qs}`);
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const res = await fetchComAuth(path, {}, false);
  if (res.status >= 500) throw new ApiError(MSG_FALHA);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = primeiraMensagem((body as Record<string, unknown>)?.detail);
    throw new ApiError(msg || 'Não foi possível exportar o arquivo. Verifique os filtros.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a); // alguns navegadores só baixam se a âncora estiver no DOM
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // dá tempo ao navegador de iniciar o download
}

// ─── Admin: Dashboard & Relatórios ────────────────────────────────────────────

export interface AdminFiltros {
  data_inicio?: string;
  data_fim?: string;
  regiao?: string;
  tipo?: string;
}

export interface DashboardKPIs {
  usuarios_total: number;
  usuarios_por_tipo: Record<string, number>;
  perfis_total: number;
  curtidas_total: number;
  recusas_total: number;
  matches_total: number;
  taxa_match: number;       // já em %
  mensagens_total: number;
  conversas_ativas: number;
  score_medio: number;      // 0–1 (fração)
  denuncias_pendentes?: number;
  usuarios_suspensos?: number;
}

/** Shape real da API — três arrays paralelos */
export interface DashboardSeriesRaw {
  matches_por_dia: { data: string; total: number }[];
  curtidas_por_dia: { data: string; total: number }[];
  mensagens_por_dia: { data: string; total: number }[];
}

/** Shape normalizada usada pelos gráficos */
export interface SeriePonto {
  data: string;
  matches: number;
  curtidas: number;
  mensagens: number;
}

export interface TopRegiao {
  regiao: string;
  perfis: number;
  matches: number;
  score_medio: number | null;
}

export interface DistribuicaoScore {
  faixa: string;
  total: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  series: DashboardSeriesRaw;
  top_regioes: TopRegiao[];
  distribuicao_score: DistribuicaoScore[];
  filtros_aplicados: Record<string, string>;
}

export interface RelatorioItem {
  id: string;
  titulo: string;
  descricao: string;
  filtros: string[];
}

export interface RelatorioResultado {
  titulo: string;
  colunas: string[];
  linhas: (string | number | null)[][];
  totais: (string | number | null)[] | Record<string, number> | null;
  filtros_aplicados: Record<string, string>;
  gerado_em: string;
}

export async function getDashboard(filtros?: AdminFiltros): Promise<DashboardData> {
  const qs = filtros ? buildQS(filtros as Record<string, unknown>) : '';
  return req<DashboardData>(`/api/admin/dashboard/${qs}`);
}

export async function listarRelatorios(): Promise<RelatorioItem[]> {
  return req<RelatorioItem[]>('/api/admin/relatorios/');
}

export async function getRelatorio(id: string, filtros?: AdminFiltros): Promise<RelatorioResultado> {
  const qs = filtros ? buildQS(filtros as Record<string, unknown>) : '';
  return req<RelatorioResultado>(`/api/admin/relatorios/${id}/${qs}`);
}

export async function downloadRelatorioCSV(id: string, filtros?: AdminFiltros): Promise<void> {
  const base: Record<string, unknown> = filtros ? { ...(filtros as Record<string, unknown>) } : {};
  base.formato = 'csv';
  const qs = buildQS(base);
  await downloadCsv(`/api/admin/relatorios/${id}/${qs}`, `relatorio-${id}.csv`);
}

// ─── Moderação ────────────────────────────────────────────────────────────────

export interface DenunciaItem {
  id: number;
  denunciante: { id: number | null; email: string | null };
  denunciado: { id: number; email: string };
  motivo: string;
  motivo_display: string;
  descricao: string;
  status: 'pendente' | 'resolvida' | 'descartada';
  resolvida_por: string | null;
  resolucao: string;
  criada_em: string;
  atualizada_em: string;
}

export interface DenunciasParams {
  status?: string;
  denunciado?: number;
  motivo?: string;
  data_inicio?: string;
  data_fim?: string;
}

export const MOTIVO_LABELS: Record<string, string> = {
  spam: 'Spam',
  ofensivo: 'Conteúdo ofensivo',
  falso: 'Perfil falso',
  outro: 'Outro',
};

export async function criarDenuncia(
  denunciado: number,
  motivo: string,
  descricao?: string,
): Promise<{ id: number; status: string }> {
  return req<{ id: number; status: string }>('/api/moderacao/denuncias/', {
    method: 'POST',
    body: JSON.stringify({ denunciado, motivo, descricao: descricao ?? '' }),
  });
}

export async function listarDenuncias(params?: DenunciasParams): Promise<DenunciaItem[]> {
  const qs = params ? buildQS(params as Record<string, unknown>) : '';
  return req<DenunciaItem[]>(`/api/admin/moderacao/denuncias/${qs}`);
}

export async function resolverDenuncia(
  id: number,
  status: 'resolvida' | 'descartada',
  resolucao?: string,
): Promise<void> {
  await req<void>(`/api/admin/moderacao/denuncias/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status, resolucao: resolucao ?? '' }),
  });
}

export async function suspenderUsuario(id: number, motivo?: string): Promise<void> {
  await req<void>(`/api/admin/moderacao/usuarios/${id}/suspender/`, {
    method: 'POST',
    body: JSON.stringify({ motivo: motivo ?? '' }),
  });
}

export async function reativarUsuario(id: number): Promise<void> {
  await req<void>(`/api/admin/moderacao/usuarios/${id}/reativar/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ─── Afinidade por IA ──────────────────────────────────────────────────────────

export type CriterioId = 'orcamento' | 'regiao' | 'rotina' | 'habitos' | 'moradia' | 'idade' | 'afinidade_ia';

export interface CriterioCompatibilidade {
  criterio: CriterioId;
  nome: string;
  peso: number;
  /** Peso usado neste par (sem a IA, os outros 6 são renormalizados). */
  peso_efetivo: number;
  valor: number | null;
  contribuicao: number;
  considerado: boolean;
}

export interface CompatibilidadeDetalhe {
  nome_ia?: string;
  perfil_id: number;
  nome: string;
  score: number;
  criterios: CriterioCompatibilidade[];
  afinidade_ia: number | null;
  similaridade_ia: number | null;
  temas_em_comum: Tema[];
  temas_meu_perfil: Tema[];
  temas_outro_perfil: Tema[];
  ia_disponivel: boolean;
  motivo_sem_ia: string | null;
}

export async function getCompatibilidade(perfilId: number): Promise<CompatibilidadeDetalhe> {
  return req<CompatibilidadeDetalhe>(`/api/compatibilidade/${perfilId}/`);
}

export type SituacaoIA = 'nao_carregado' | 'carregando' | 'disponivel' | 'indisponivel' | 'desabilitada';

export interface IAStatus {
  /** Nome exibido da IA. */
  nome_ia?: string;
  habilitada: boolean;
  disponivel: boolean;
  situacao: SituacaoIA;
  situacao_texto: string;
  erro: string | null;
  modelo: string;
  dimensoes: number;
  modelo_baixado: boolean;
  tempo_carregamento_ms: number | null;
  perfis_total: number;
  perfis_com_texto_suficiente: number;
  perfis_com_embedding: number;
  perfis_sem_embedding_com_texto: number;
  temas_cadastrados: number;
  temas: (Tema & { perfis: number })[];
  tempo_medio_geracao_ms: number | null;
  /** Mediana do tempo de geração (sem a carga do modelo): o tempo típico de uma bio. */
  tempo_tipico_geracao_ms?: number | null;
  ultima_atualizacao: string | null;
  calibracao: Record<string, number>;
}

export async function getIAStatus(): Promise<IAStatus> {
  return req<IAStatus>('/api/admin/ia/status/');
}

export interface IATesteResultado {
  similaridade: number;
  afinidade: number;
  temas_a: Tema[];
  temas_b: Tema[];
  temas_em_comum: Tema[];
  tempo_ms: number;
  modelo: string;
}

export async function testarIA(texto_a: string, texto_b: string): Promise<IATesteResultado> {
  return req<IATesteResultado>('/api/admin/ia/testar/', { method: 'POST', body: JSON.stringify({ texto_a, texto_b }) });
}

// ─── Processamento em lote (benchmark de paralelismo) ─────────────────────────

export type ModoParalelo = 'sequencial' | 'threads' | 'processos';

export interface BenchmarkLinha {
  N: number;
  pares: number;
  modo: ModoParalelo;
  workers: number;
  tempo_mediana_s: number;
  speedup: number | null;
  eficiencia: number | null;
  identico_ao_sequencial: boolean;
  memoria_por_worker_mb?: number | null;
}

export interface BenchmarkAmdahl {
  N: number;
  modo: ModoParalelo;
  fracao_paralelizavel: number;
  speedup_maximo_teorico: number | null;
}

export interface BenchmarkEmbeddings {
  bios: number;
  workers: number;
  tempo_mediana_s: number;
  ms_por_bio: number;
  speedup: number;
}

export interface BenchmarkPontaAPonta {
  N: number;
  pares: number;
  modo: ModoParalelo;
  workers: number;
  tempo_carregar_s: number;
  tempo_calcular_s: number;
  tempo_gravar_s: number;
  tempo_total_s: number;
  fracao_sequencial_banco: number;
  speedup_total: number;
}

export interface BenchmarkParalelismo {
  gerado_em: string;
  duracao_total_s?: number;
  ambiente: {
    cpu?: string; nucleos_fisicos?: number | null; nucleos_logicos?: number | null; ram_total_mb?: number | null;
    ram_livre_mb?: number | null; carga_cpu_inicio_pct?: number | null; carga_cpu_fundo_pct?: number | null;
    sistema?: string; python?: string; numpy?: string;
  };
  parametros?: { repeticoes?: number; bloco?: string };
  recalculo: BenchmarkLinha[];
  amdahl: BenchmarkAmdahl[];
  embeddings: BenchmarkEmbeddings[];
  ponta_a_ponta: BenchmarkPontaAPonta[];
  observacoes: string[];
}

export async function getBenchmarkParalelismo(): Promise<BenchmarkParalelismo> {
  return req<BenchmarkParalelismo>('/api/admin/processamento/benchmark/');
}
