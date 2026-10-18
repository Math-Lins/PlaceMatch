const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

let _on401: (() => void) | null = null;
export function setOn401(cb: () => void): void {
  _on401 = cb;
}

function getToken(): string | null {
  return localStorage.getItem('pm_access');
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem('pm_access', access);
  localStorage.setItem('pm_refresh', refresh);
}

export function logout(): void {
  localStorage.removeItem('pm_access');
  localStorage.removeItem('pm_refresh');
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
    localStorage.removeItem('pm_access');
    localStorage.removeItem('pm_refresh');
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

export async function listarDescoberta(): Promise<PerfilDescoberto[]> {
  return req<PerfilDescoberto[]>('/api/descoberta/');
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

export async function listarConversas(): Promise<Conversa[]> {
  return req<Conversa[]>('/api/conversas/');
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
