import { useState, useEffect } from 'react';
import { listarRelatorios, getRelatorio, downloadRelatorioCSV, ApiError } from '../api';
import type { RelatorioItem, RelatorioResultado, AdminFiltros } from '../api';

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

// ─── Filter key metadata ───────────────────────────────────────────────────────

const FILTRO_META: Record<string, { label: string; tipo: 'date' | 'text' | 'select' }> = {
  data_inicio: { label: 'Data inicial', tipo: 'date' },
  data_fim: { label: 'Data final', tipo: 'date' },
  regiao: { label: 'Região', tipo: 'text' },
  tipo: { label: 'Tipo', tipo: 'select' },
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'buscando_vaga', label: 'Buscando vaga' },
  { value: 'oferecendo_vaga', label: 'Oferecendo vaga' },
];

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtCell(v: string | number | null): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

// ─── FilterInputs ─────────────────────────────────────────────────────────────

function FilterInputs({
  filtroKeys,
  values,
  onChange,
}: {
  filtroKeys: string[];
  values: AdminFiltros;
  onChange: (key: string, val: string) => void;
}) {
  if (!filtroKeys.length) return null;

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, background: C.card,
    outline: 'none', minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
      {filtroKeys.map(key => {
        const meta = FILTRO_META[key];
        if (!meta) return null;
        const rawVal = (values as Record<string, string | undefined>)[key] ?? '';

        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>
              {meta.label}
            </label>
            {meta.tipo === 'select' ? (
              <select value={rawVal} onChange={e => onChange(key, e.target.value)} style={inputStyle}>
                {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={meta.tipo === 'date' ? 'date' : 'text'}
                value={rawVal}
                onChange={e => onChange(key, e.target.value)}
                placeholder={meta.tipo === 'text' ? 'Ex: São Paulo' : undefined}
                style={inputStyle}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ResultTable ──────────────────────────────────────────────────────────────

function ResultTable({ resultado }: { resultado: RelatorioResultado }) {
  return (
    <div>
      {/* Meta info */}
      <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 800, color: C.text }}>
          {resultado.titulo}
        </span>
        <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted }}>
          Gerado em {formatDateBR(resultado.gerado_em)}
        </span>
        {Object.keys(resultado.filtros_aplicados).length > 0 && (
          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted }}>
            Filtros: {Object.entries(resultado.filtros_aplicados).map(([k, v]) => `${k}: ${v}`).join(', ')}
          </span>
        )}
      </div>

      {/* Totais como objeto (ex: {matches: 18, mensagens: 3}) */}
      {resultado.totais && !Array.isArray(resultado.totais) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
          {Object.entries(resultado.totais as Record<string, number>).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted }}>{k}:</span>
              <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 800, color: C.text }}>
                {typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito,sans-serif', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
              {resultado.colunas.map(col => (
                <th
                  key={col}
                  style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultado.linhas.length === 0 ? (
              <tr>
                <td
                  colSpan={resultado.colunas.length}
                  style={{ padding: '24px 12px', textAlign: 'center', color: C.muted, fontStyle: 'italic' }}
                >
                  Nenhum resultado para os filtros aplicados.
                </td>
              </tr>
            ) : (
              resultado.linhas.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid ${C.border}`, background: C.card }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '10px 12px', color: C.text }}>
                      {fmtCell(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {/* Totals row — só quando for array */}
            {Array.isArray(resultado.totais) && resultado.totais.length > 0 && (
              <tr style={{ background: `${C.primary}08`, borderTop: `2px solid ${C.border}` }}>
                {(resultado.totais as (string | number | null)[]).map((cell, ci) => (
                  <td
                    key={ci}
                    style={{ padding: '10px 12px', fontFamily: 'Outfit,sans-serif', fontWeight: 800, color: C.text }}
                  >
                    {fmtCell(cell)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── RelatoriosTab ────────────────────────────────────────────────────────────

export default function RelatoriosTab() {
  const [catalogo, setCatalogo] = useState<RelatorioItem[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [erroCatalogo, setErroCatalogo] = useState('');

  const [selectedId, setSelectedId] = useState<string>('');
  const [filtros, setFiltros] = useState<AdminFiltros>({});

  const [resultado, setResultado] = useState<RelatorioResultado | null>(null);
  const [loadingRel, setLoadingRel] = useState(false);
  const [erroRel, setErroRel] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listarRelatorios()
      .then(items => {
        setCatalogo(items);
        setLoadingCatalogo(false);
        if (items.length) setSelectedId(items[0].id);
      })
      .catch((e: Error) => {
        setErroCatalogo(e instanceof ApiError ? e.message : 'Erro ao carregar catálogo.');
        setLoadingCatalogo(false);
      });
  }, []);

  // Reset filtros when report changes
  useEffect(() => { setFiltros({}); setResultado(null); setErroRel(''); }, [selectedId]);

  const selectedRel = catalogo.find(r => r.id === selectedId);

  const handleFiltroChange = (key: string, val: string) => {
    setFiltros(prev => ({ ...prev, [key]: val || undefined }));
  };

  const handleGerar = () => {
    if (!selectedId) return;
    setLoadingRel(true);
    setErroRel('');
    setResultado(null);
    getRelatorio(selectedId, filtros)
      .then(res => { setResultado(res); setLoadingRel(false); })
      .catch((e: Error) => {
        setErroRel(e instanceof ApiError ? e.message : 'Erro ao gerar relatório.');
        setLoadingRel(false);
      });
  };

  const handleExport = async () => {
    if (!selectedId) return;
    setExporting(true);
    try {
      await downloadRelatorioCSV(selectedId, filtros);
    } catch (e) {
      setErroRel(e instanceof Error ? e.message : 'Erro ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, background: C.card,
    outline: 'none',
  };

  // ── catalog loading ──
  if (loadingCatalogo) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
        Carregando relatórios...
      </div>
    );
  }

  if (erroCatalogo) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: C.danger, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>{erroCatalogo}</p>
        <button
          onClick={() => { setErroCatalogo(''); setLoadingCatalogo(true); }}
          style={{ marginTop: '12px', padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!catalogo.length) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
        Nenhum relatório disponível.
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Report selector */}
      <div style={{ background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 800, color: C.text, margin: 0 }}>
          Selecionar relatório
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {catalogo.map(rel => (
            <label
              key={rel.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer',
                padding: '12px 14px', borderRadius: '12px',
                border: `2px solid ${selectedId === rel.id ? C.primary : C.border}`,
                background: selectedId === rel.id ? `${C.primary}08` : C.bg,
              }}
            >
              <input
                type="radio" name="relatorio" value={rel.id}
                checked={selectedId === rel.id}
                onChange={() => setSelectedId(rel.id)}
                style={{ marginTop: '2px', accentColor: C.primary }}
              />
              <div>
                <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 2px' }}>
                  {rel.titulo}
                </p>
                <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, margin: 0 }}>
                  {rel.descricao}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Filters for selected report */}
      {selectedRel && selectedRel.filtros.length > 0 && (
        <div style={{ background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 800, color: C.text, margin: '0 0 14px' }}>
            Filtros
          </h3>
          <FilterInputs
            filtroKeys={selectedRel.filtros}
            values={filtros}
            onChange={handleFiltroChange}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleGerar}
          disabled={!selectedId || loadingRel}
          style={{
            padding: '10px 22px', borderRadius: '12px', border: 'none',
            background: !selectedId || loadingRel ? C.border : C.primary,
            color: !selectedId || loadingRel ? C.muted : '#fff',
            fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
            cursor: !selectedId || loadingRel ? 'not-allowed' : 'pointer',
          }}
        >
          {loadingRel ? 'Gerando...' : 'Gerar relatório'}
        </button>
        {resultado && (
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '10px 22px', borderRadius: '12px',
              border: `1.5px solid ${C.border}`, background: C.card, color: C.text,
              fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
              cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1,
            }}
          >
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        )}
      </div>

      {/* Error */}
      {erroRel && (
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, margin: 0 }}>
          {erroRel}
        </p>
      )}

      {/* Loading */}
      {loadingRel && (
        <div style={{ textAlign: 'center', padding: '30px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
          Gerando relatório...
        </div>
      )}

      {/* Results */}
      {!loadingRel && resultado && (
        <div style={{ background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}` }}>
          <ResultTable resultado={resultado} />
        </div>
      )}
    </div>
  );
}
