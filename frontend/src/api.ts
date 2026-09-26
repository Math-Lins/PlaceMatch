const BASE = 'http://127.0.0.1:8000';

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
