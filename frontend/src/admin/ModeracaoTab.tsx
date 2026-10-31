import { useState, useEffect, useCallback } from 'react';
import {
  listarDenuncias, resolverDenuncia, suspenderUsuario,
  downloadRelatorioCSV, ApiError,
} from '../api';
import type { DenunciaItem, AdminFiltros } from '../api';

const C = {
  primary: '#E06B45', mint: '#5DBF96', bg: '#FBF8F5', card: '#FFFFFF',
  text: '#2A2420', muted: '#8A7E78', border: '#EDE8E3', danger: '#E05555',
};

const MOTIVO_LABELS: Record<string, string> = {
  spam: 'Spam', ofensivo: 'Conteúdo ofensivo', falso: 'Perfil falso', outro: 'Outro',
};

const STATUS_COLORS: Record<string, string> = {
  pendente: '#E0A445',
  resolvida: '#5DBF96',
  descartada: '#8A7E78',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  resolvida: 'Procedente',
  descartada: 'Improcedente',
};

// Map frontend filter labels to backend status values
const FILTRO_STATUS: { value: string; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'resolvida', label: 'Procedentes' },
  { value: 'descartada', label: 'Improcedentes' },
];

const MOTIVO_OPTS = [
  { value: '', label: 'Todos os motivos' },
  { value: 'spam', label: 'Spam' },
  { value: 'ofensivo', label: 'Conteúdo ofensivo' },
  { value: 'falso', label: 'Perfil falso' },
  { value: 'outro', label: 'Outro' },
];

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  } catch { return iso; }
}

// ─── Analisar Modal ───────────────────────────────────────────────────────────

interface AnalisarModalProps {
  denuncia: DenunciaItem;
  onClose: () => void;
  onConcluido: () => void;
}

function AnalisarModal({ denuncia, onClose, onConcluido }: AnalisarModalProps) {
  const [decisao, setDecisao] = useState<'resolvida' | 'descartada' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [suspender, setSuspender] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirmar = async () => {
    if (!decisao) { setErro('Selecione uma decisão.'); return; }
    setErro('');
    setLoading(true);
    try {
      await resolverDenuncia(denuncia.id, decisao, observacao);
      if (suspender && decisao === 'resolvida' && denuncia.denunciado.id) {
        await suspenderUsuario(denuncia.denunciado.id, `Denúncia #${denuncia.id} procedente.`);
      }
      onConcluido();
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao processar.');
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, background: C.card, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Analisar denúncia"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 800, color: C.text, margin: 0 }}>Analisar denúncia #{denuncia.id}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '20px' }}>✕</button>
        </div>

        <div style={{ background: C.bg, borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', fontFamily: 'Nunito,sans-serif', color: C.text }}>
          <p style={{ margin: '0 0 4px' }}><strong>Denunciante:</strong> {denuncia.denunciante.email ?? '—'}</p>
          <p style={{ margin: '0 0 4px' }}><strong>Denunciado:</strong> {denuncia.denunciado.email}</p>
          <p style={{ margin: '0 0 4px' }}><strong>Motivo:</strong> {MOTIVO_LABELS[denuncia.motivo] ?? denuncia.motivo_display}</p>
          {denuncia.descricao && <p style={{ margin: '0' }}><strong>Descrição:</strong> {denuncia.descricao}</p>}
        </div>

        <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.muted, marginBottom: '8px' }}>Decisão</p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {[
            { value: 'resolvida' as const, label: 'Procedente' },
            { value: 'descartada' as const, label: 'Improcedente' },
          ].map(opt => (
            <button key={opt.value} onClick={() => { setDecisao(opt.value); if (opt.value !== 'resolvida') setSuspender(false); }} style={{
              flex: 1, padding: '10px', borderRadius: '12px', cursor: 'pointer',
              border: `2px solid ${decisao === opt.value ? C.primary : C.border}`,
              background: decisao === opt.value ? `${C.primary}12` : C.bg,
              color: decisao === opt.value ? C.primary : C.muted,
              fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 700,
            }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Observação interna sobre a decisão..."
            style={{ ...inputStyle, resize: 'none', height: '72px' }}
          />
        </div>

        {decisao === 'resolvida' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', cursor: 'pointer', fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={suspender}
              onChange={e => setSuspender(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: C.danger }}
            />
            Suspender a conta do denunciado
          </label>
        )}

        {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginBottom: '12px', textAlign: 'center' }}>{erro}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ModeracaoTab ─────────────────────────────────────────────────────────────

export default function ModeracaoTab() {
  const [denuncias, setDenuncias] = useState<DenunciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [analisando, setAnalisando] = useState<DenunciaItem | null>(null);

  // Filters
  const [status, setStatus] = useState('pendente');
  const [motivo, setMotivo] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const carregar = useCallback((params: { status?: string; motivo?: string }) => {
    setLoading(true);
    setErro('');
    listarDenuncias({ status: params.status || undefined, motivo: params.motivo || undefined })
      .then(res => { setDenuncias(res); setLoading(false); })
      .catch((e: Error) => { setErro(e instanceof ApiError ? e.message : e.message); setLoading(false); });
  }, []);

  useEffect(() => { carregar({ status: 'pendente' }); }, [carregar]);

  const handleBuscar = () => carregar({ status, motivo });

  const handleExport = async () => {
    setExporting(true);
    try {
      const filtros: AdminFiltros = {};
      if (dataInicio) filtros.data_inicio = dataInicio;
      if (dataFim) filtros.data_fim = dataFim;
      await downloadRelatorioCSV('denuncias', filtros);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  const buscaLower = busca.toLowerCase();
  const filtradas = busca
    ? denuncias.filter(d =>
        (d.denunciante.email ?? '').toLowerCase().includes(buscaLower) ||
        d.denunciado.email.toLowerCase().includes(buscaLower)
      )
    : denuncias;

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, background: C.card, outline: 'none', minWidth: 0,
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            {FILTRO_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Motivo</label>
          <select value={motivo} onChange={e => setMotivo(e.target.value)} style={inputStyle}>
            {MOTIVO_OPTS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Buscar (e-mail)</label>
          <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBuscar()} placeholder="Buscar denunciante/denunciado..." style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={handleBuscar} style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}>
          Buscar
        </button>
        <button onClick={handleExport} disabled={exporting} style={{ padding: '8px 18px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', alignSelf: 'flex-end', opacity: exporting ? 0.7 : 1 }}>
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>Carregando denúncias...</div>
      )}
      {!loading && erro && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px' }}>
          <p style={{ color: C.danger, fontFamily: 'Nunito,sans-serif', fontSize: '14px', textAlign: 'center' }}>{erro}</p>
          <button onClick={handleBuscar} style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !erro && filtradas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>Nenhuma denúncia encontrada.</div>
      )}

      {/* Table */}
      {!loading && !erro && filtradas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito,sans-serif', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                {['Data', 'Denunciante', 'Denunciado', 'Motivo', 'Status', 'Ação'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(d => {
                const isExpanded = expanded === d.id;
                const statusColor = STATUS_COLORS[d.status] ?? C.muted;
                return (
                  <>
                    <tr
                      key={d.id}
                      style={{ borderBottom: `1px solid ${C.border}`, background: isExpanded ? `${C.primary}06` : C.card, cursor: 'pointer' }}
                      onClick={() => setExpanded(isExpanded ? null : d.id)}
                    >
                      <td style={{ padding: '10px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{formatDateBR(d.criada_em)}</td>
                      <td style={{ padding: '10px 12px', color: C.text }}>{d.denunciante.email ?? '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: C.text }}>{d.denunciado.email}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: C.muted }}>{MOTIVO_LABELS[d.motivo] ?? d.motivo_display}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '8px', background: `${statusColor}20`, color: statusColor, fontWeight: 700, fontSize: '12px' }}>
                          {STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        {d.status === 'pendente' && (
                          <button
                            onClick={() => setAnalisando(d)}
                            style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Analisar
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${d.id}-exp`} style={{ background: `${C.primary}06` }}>
                        <td colSpan={6} style={{ padding: '12px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontFamily: 'Nunito,sans-serif', color: C.text }}>
                            {d.descricao && (
                              <p style={{ margin: 0 }}><strong>Descrição:</strong> {d.descricao}</p>
                            )}
                            {d.resolucao && (
                              <p style={{ margin: 0 }}><strong>Observação:</strong> {d.resolucao}</p>
                            )}
                            {d.resolvida_por && (
                              <p style={{ margin: 0, color: C.muted }}><strong>Resolvida por:</strong> {d.resolvida_por} · {formatDateBR(d.atualizada_em)}</p>
                            )}
                            {!d.descricao && !d.resolucao && !d.resolvida_por && (
                              <p style={{ margin: 0, color: C.muted, fontStyle: 'italic' }}>Sem detalhes adicionais.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {!loading && !erro && filtradas.length > 0 && (
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, marginTop: '12px' }}>
          {filtradas.length} denúncia{filtradas.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Analisar modal */}
      {analisando && (
        <AnalisarModal
          denuncia={analisando}
          onClose={() => setAnalisando(null)}
          onConcluido={() => { setAnalisando(null); carregar({ status, motivo }); }}
        />
      )}
    </div>
  );
}
