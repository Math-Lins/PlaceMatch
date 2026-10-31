import { useState, useEffect, useCallback } from 'react';
import { listarAdminUsuarios, downloadCsv, suspenderUsuario, reativarUsuario, ApiError } from '../api';
import type { UsuarioAdmin, PaginatedResponse } from '../api';

const C = {
  primary: '#E06B45',
  mint: '#5DBF96',
  bg: '#FBF8F5',
  card: '#FFFFFF',
  text: '#2A2420',
  muted: '#8A7E78',
  border: '#EDE8E3',
  danger: '#E05555',
};

const TIPOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'buscando_vaga', label: 'Buscando vaga' },
  { value: 'oferecendo_vaga', label: 'Oferecendo vaga' },
  { value: 'administrador', label: 'Administrador' },
];

const TIPO_LABEL: Record<string, string> = {
  buscando_vaga: 'Buscando vaga',
  oferecendo_vaga: 'Oferecendo vaga',
  administrador: 'Administrador',
};

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Suspender Modal ──────────────────────────────────────────────────────────

function SuspenderModal({ usuario, onClose, onConcluido }: {
  usuario: UsuarioAdmin;
  onClose: () => void;
  onConcluido: (u: UsuarioAdmin) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirmar = async () => {
    setErro('');
    setLoading(true);
    try {
      await suspenderUsuario(usuario.id, motivo);
      onConcluido({ ...usuario, ativo: false });
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao suspender.');
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
        <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>Suspender conta</h3>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 20px' }}>{usuario.email}</p>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>Motivo (opcional)</label>
          <input
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Comportamento abusivo"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1.5px solid ${C.border}`, fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, background: C.bg, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginBottom: '12px', textAlign: 'center' }}>{erro}</p>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleConfirmar} disabled={loading} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: C.danger, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Suspendendo...' : 'Suspender'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UsuariosTab ──────────────────────────────────────────────────────────────

export default function UsuariosTab() {
  const [data, setData] = useState<PaginatedResponse<UsuarioAdmin> | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [exporting, setExporting] = useState(false);
  const [suspendendo, setSuspendendo] = useState<UsuarioAdmin | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionErro, setActionErro] = useState('');

  // Filters
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [regiao, setRegiao] = useState('');
  const [ativo, setAtivo] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const carregar = useCallback((pg: number) => {
    setLoading(true);
    setErro('');
    listarAdminUsuarios({
      q: q || undefined,
      tipo: tipo || undefined,
      regiao: regiao || undefined,
      ativo: ativo || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      page: pg,
    })
      .then(res => { setData(res); setLoading(false); })
      .catch((e: Error) => { setErro(e instanceof ApiError ? e.message : e.message); setLoading(false); });
  }, [q, tipo, regiao, ativo, dataInicio, dataFim]);

  useEffect(() => { carregar(page); }, [carregar, page]);

  const handleSearch = () => { setPage(1); carregar(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (tipo) qs.set('tipo', tipo);
      if (regiao) qs.set('regiao', regiao);
      if (ativo) qs.set('ativo', ativo);
      if (dataInicio) qs.set('data_inicio', dataInicio);
      if (dataFim) qs.set('data_fim', dataFim);
      const str = qs.toString();
      await downloadCsv(`/api/admin/usuarios/exportar/${str ? '?' + str : ''}`, 'usuarios.csv');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleReativar = async (u: UsuarioAdmin) => {
    setActionLoading(u.id);
    setActionErro('');
    try {
      await reativarUsuario(u.id);
      setData(d => d ? { ...d, results: d.results.map(r => r.id === u.id ? { ...r, ativo: true } : r) } : d);
    } catch (e: unknown) {
      setActionErro(e instanceof ApiError ? e.message : 'Erro ao reativar.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspenderConcluido = (updated: UsuarioAdmin) => {
    setSuspendendo(null);
    setData(d => d ? { ...d, results: d.results.map(r => r.id === updated.id ? updated : r) } : d);
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, background: C.card,
    outline: 'none', minWidth: 0,
  };

  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Nome ou e-mail</label>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Pesquisar..." style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Região</label>
          <input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder="Ex: São Paulo" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Situação</label>
          <select value={ativo} onChange={e => setAtivo(e.target.value)} style={inputStyle}>
            <option value="">Todas</option>
            <option value="true">Ativo</option>
            <option value="false">Suspenso</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Cadastro de</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={handleSearch} style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}>
          Buscar
        </button>
        <button onClick={handleExport} disabled={exporting} style={{ padding: '8px 18px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', alignSelf: 'flex-end', opacity: exporting ? 0.7 : 1 }}>
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {actionErro && (
        <p style={{ color: C.danger, fontFamily: 'Nunito,sans-serif', fontSize: '13px', marginBottom: '12px' }}>{actionErro}</p>
      )}

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
          Carregando usuários...
        </div>
      )}
      {!loading && erro && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px' }}>
          <p style={{ color: C.danger, fontFamily: 'Nunito,sans-serif', fontSize: '14px', textAlign: 'center' }}>{erro}</p>
          <button onClick={() => carregar(page)} style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !erro && data && data.results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
          Nenhum usuário encontrado para os filtros aplicados.
        </div>
      )}

      {/* Table */}
      {!loading && !erro && data && data.results.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito,sans-serif', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {['Nome', 'E-mail', 'Tipo', 'Situação', 'Região', 'Cadastro', 'Perfil', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.results.map(u => {
                const isAdmin = u.tipo === 'administrador';
                const isLoading = actionLoading === u.id;
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}`, background: C.card, opacity: isLoading ? 0.7 : 1 }}>
                    <td style={{ padding: '10px 12px', color: C.text, fontWeight: 600 }}>{u.nome}</td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '8px', background: `${C.primary}18`, color: C.text, fontWeight: 600, fontSize: '12px' }}>
                        {TIPO_LABEL[u.tipo] ?? u.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '8px', fontWeight: 700, fontSize: '12px',
                        background: u.ativo ? `${C.mint}20` : `${C.danger}18`,
                        color: u.ativo ? '#3EA87A' : C.danger,
                      }}>
                        {u.ativo ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{u.regiao ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{formatDateBR(u.data_cadastro)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '16px' }}>{u.tem_perfil ? '✅' : '—'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {!isAdmin && (
                        u.ativo ? (
                          <button
                            onClick={() => setSuspendendo(u)}
                            disabled={isLoading}
                            style={{ padding: '4px 10px', borderRadius: '8px', border: `1.5px solid ${C.danger}`, background: 'none', color: C.danger, fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Suspender
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReativar(u)}
                            disabled={isLoading}
                            style={{ padding: '4px 10px', borderRadius: '8px', border: `1.5px solid ${C.mint}`, background: 'none', color: '#3EA87A', fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            {isLoading ? '...' : 'Reativar'}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !erro && data && data.count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted }}>
            {data.count} usuário{data.count !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '6px 14px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? C.muted : C.text, fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 600 }}
            >
              ← Anterior
            </button>
            <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text }}>
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '6px 14px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: page >= totalPages ? C.muted : C.text, fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 600 }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* Suspender modal */}
      {suspendendo && (
        <SuspenderModal
          usuario={suspendendo}
          onClose={() => setSuspendendo(null)}
          onConcluido={handleSuspenderConcluido}
        />
      )}
    </div>
  );
}
