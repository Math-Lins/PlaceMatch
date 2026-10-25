const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

let _on401: (() => void) | null = null;
export function setOn401(cb: () => void): void {
  _on401 = cb;
}

function getToken(): string | null {
  return sessionStorage.getItem('pm_access');
}

function setTokens(access: string, refresh: string): void {
  sessionStorage.setItem('pm_access', access);
  sessionStorage.setItem('pm_refresh', refresh);
}

export function logout(): void {
  sessionStorage.removeItem('pm_access');
  sessionStorage.removeItem('pm_refresh');
}

export class ApiError extends Error {
  fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
  }
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique se o backend está rodando.'
    );
  }

  if (res.status === 204) return {} as T;
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    sessionStorage.removeItem('pm_access');
    sessionStorage.removeItem('pm_refresh');
    _on401?.();
    throw new ApiError('Sua sessão expirou. Entre novamente.');
  }

  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    let firstMsg = '';

    if (body && typeof body === 'object') {
      for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
        const msg = Array.isArray(val) ? String(val[0]) : String(val);
        if (!firstMsg) firstMsg = msg;
        if (key !== 'detail' && key !== 'non_field_errors') {
          fieldErrors[key] = msg;
        }
      }
    }

    const msg =
      (body as Record<string, string>)?.detail ||
      (body as Record<string, string[]>)?.non_field_errors?.[0] ||
      firstMsg ||
      `Erro ${res.status}`;
    throw new ApiError(String(msg), fieldErrors);
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
}

export interface Perfil extends PerfilPayload {
  id: number;
  usuario: number;
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
  tipo?: 'buscando_vaga' | 'oferecendo_vaga';
  titulo_anuncio?: string | null;
  descricao_imovel?: string | null;
  fotos_imovel?: string[];
  foto_perfil_url?: string | null;
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

export async function listarDescoberta(params?: DescobertaParams): Promise<PerfilDescoberto[]> {
  const qs = params ? buildQS(params as Record<string, unknown>) : '';
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
  outro_perfil: { id: number; nome: string; idade: number; regiao: string };
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
  const token = getToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor.');
  }
  if (!res.ok) throw new ApiError(`Erro ${res.status} ao exportar CSV.`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
