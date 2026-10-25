import React, { useState, useEffect, useCallback } from 'react';
import { listarLogs, downloadCsv, ApiError } from '../api';
import type { LogEntry, PaginatedResponse } from '../api';

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

const ACOES: { value: string; label: string }[] = [
  { value: '', label: 'Todas as ações' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'cadastro', label: 'Cadastro' },
  { value: 'criou_perfil', label: 'Criou perfil' },
  { value: 'atualizou_perfil', label: 'Atualizou perfil' },
  { value: 'excluiu_perfil', label: 'Excluiu perfil' },
  { value: 'enviou_curtida', label: 'Enviou curtida' },
  { value: 'match', label: 'Match' },
  { value: 'enviou_mensagem', label: 'Enviou mensagem' },
  { value: 'denuncia', label: 'Denúncia' },
  { value: 'bloqueio', label: 'Bloqueio' },
];

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ExpandedDetails({ detalhes }: { detalhes: Record<string, unknown> }) {
  const entries = Object.entries(detalhes);
  if (entries.length === 0) return <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: '8px', fontFamily: 'Nunito,sans-serif', fontSize: '12px' }}>
          <span style={{ fontWeight: 700, color: C.text, flexShrink: 0 }}>{k}:</span>
          <span style={{ color: C.muted, wordBreak: 'break-all' }}>
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LogsTab() {
  const [data, setData] = useState<PaginatedResponse<LogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [acao, setAcao] = useState('');
  const [usuario, setUsuario] = useState('');
  const [entidade, setEntidade] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const carregar = useCallback((pg: number) => {
    setLoading(true);
    setErro('');
    listarLogs({ acao: acao || undefined, usuario: usuario || undefined, entidade: entidade || undefined, data_inicio: dataInicio || undefined, data_fim: dataFim || undefined, page: pg })
      .then(res => { setData(res); setLoading(false); })
      .catch((e: Error) => { setErro(e instanceof ApiError ? e.message : e.message); setLoading(false); });
  }, [acao, usuario, entidade, dataInicio, dataFim]);

  useEffect(() => { carregar(page); }, [carregar, page]);

  const handleSearch = () => { setPage(1); carregar(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (acao) qs.set('acao', acao);
      if (usuario) qs.set('usuario', usuario);
      if (entidade) qs.set('entidade', entidade);
      if (dataInicio) qs.set('data_inicio', dataInicio);
      if (dataFim) qs.set('data_fim', dataFim);
      const str = qs.toString();
      await downloadCsv(`/api/admin/logs/exportar/${str ? '?' + str : ''}`, 'logs.csv');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao exportar.');
    } finally {
      setExporting(false);
    }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Ação</label>
          <select value={acao} onChange={e => setAcao(e.target.value)} style={inputStyle}>
            {ACOES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Usuário</label>
          <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Nome ou e-mail" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Entidade</label>
          <input value={entidade} onChange={e => setEntidade(e.target.value)} placeholder="Ex: Perfil" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={handleSearch}
          style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}
        >
          Buscar
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: '8px 18px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', alignSelf: 'flex-end', opacity: exporting ? 0.7 : 1 }}
        >
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
          Carregando logs...
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
          Nenhum log encontrado para os filtros aplicados.
        </div>
      )}

      {/* Table */}
      {!loading && !erro && data && data.results.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito,sans-serif', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'IP', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.results.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: expanded === log.id ? `${C.primary}08` : C.card }}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: C.text }}>{formatDateBR(log.data_hora)}</td>
                    <td style={{ padding: '10px 12px', color: log.usuario ? C.text : C.muted, fontStyle: log.usuario ? 'normal' : 'italic' }}>
                      {log.usuario
                        ? log.usuario.nome === log.usuario.email
                          ? log.usuario.nome
                          : `${log.usuario.nome} (${log.usuario.email})`
                        : 'Usuário removido'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '8px', background: `${C.mint}20`, color: C.text, fontWeight: 600, fontSize: '12px' }}>
                        {log.acao_label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>
                      {log.entidade}{log.entidade_id !== null ? ` #${log.entidade_id}` : ''}
                    </td>
                    <td style={{ padding: '10px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{log.ip ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>
                      {expanded === log.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr style={{ background: `${C.primary}06` }}>
                      <td colSpan={6} style={{ padding: '12px 24px 16px' }}>
                        <ExpandedDetails detalhes={log.detalhes} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !erro && data && data.count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted }}>
            {data.count} resultado{data.count !== 1 ? 's' : ''}
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
    </div>
  );
}
