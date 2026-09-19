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

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return {} as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.detail ||
      body?.non_field_errors?.[0] ||
      (Object.values(body as Record<string, string[]>)[0] as string[] | undefined)?.[0] ||
      `Erro ${res.status}`;
    throw new Error(String(msg));
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
