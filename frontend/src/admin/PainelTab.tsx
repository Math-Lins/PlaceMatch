import { useState, useEffect, useCallback } from 'react';
import { getDashboard, ApiError } from '../api';
import type { DashboardData, SeriePonto, AdminFiltros } from '../api';
import { LineAreaChart, HorizontalBars, ScoreDistChart } from './graficos';

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

// ─── KPI definitions ──────────────────────────────────────────────────────────

type KpiFmt = 'num' | 'pct' | 'pct01';

const KPI_DEFS: { key: keyof import('../api').DashboardKPIs; label: string; fmt: KpiFmt }[] = [
  { key: 'usuarios_total',    label: 'Usuários',          fmt: 'num'   },
  { key: 'perfis_total',      label: 'Perfis',            fmt: 'num'   },
  { key: 'curtidas_total',    label: 'Curtidas',          fmt: 'num'   },
  { key: 'matches_total',     label: 'Matches',           fmt: 'num'   },
  { key: 'taxa_match',        label: 'Taxa de match',     fmt: 'pct'   },
  { key: 'mensagens_total',   label: 'Mensagens',         fmt: 'num'   },
  { key: 'conversas_ativas',  label: 'Conversas ativas',  fmt: 'num'   },
  { key: 'score_medio',       label: 'Score médio',       fmt: 'pct01' },
];

function fmtKpi(val: number | undefined | null, fmt: KpiFmt): string {
  if (val == null || isNaN(Number(val))) return '—';
  const n = Number(val);
  if (fmt === 'pct')   return `${n.toFixed(1).replace('.', ',')}%`;
  if (fmt === 'pct01') return `${(n * 100).toFixed(1).replace('.', ',')}%`;
  return n.toLocaleString('pt-BR');
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ h = 20, w = '100%' }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8, background: '#EDE8E3',
      flexShrink: 0,
    }} />
  );
}

function SkeletonDash() {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ background: C.card, borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Sk h={12} w="60%" />
            <Sk h={28} w="80%" />
          </div>
        ))}
      </div>
      <div style={{ background: C.card, borderRadius: '16px', padding: '20px' }}>
        <Sk h={14} w="180px" />
        <div style={{ marginTop: '16px' }}><Sk h={220} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: C.card, borderRadius: '16px', padding: '20px' }}>
          <Sk h={14} w="140px" />
          <div style={{ marginTop: '16px' }}><Sk h={160} /></div>
        </div>
        <div style={{ background: C.card, borderRadius: '16px', padding: '20px' }}>
          <Sk h={14} w="180px" />
          <div style={{ marginTop: '16px' }}><Sk h={160} /></div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  draft,
  setDraft,
  onApply,
  onClear,
}: {
  draft: AdminFiltros;
  setDraft: React.Dispatch<React.SetStateAction<AdminFiltros>>;
  onApply: () => void;
  onClear: () => void;
}) {
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.text, background: C.card,
    outline: 'none', minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>De</label>
        <input
          type="date" value={draft.data_inicio ?? ''}
          onChange={e => setDraft(d => ({ ...d, data_inicio: e.target.value || undefined }))}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Até</label>
        <input
          type="date" value={draft.data_fim ?? ''}
          onChange={e => setDraft(d => ({ ...d, data_fim: e.target.value || undefined }))}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
        <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Região</label>
        <input
          placeholder="Ex: São Paulo"
          value={draft.regiao ?? ''}
          onChange={e => setDraft(d => ({ ...d, regiao: e.target.value || undefined }))}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
        <label style={{ fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted }}>Tipo</label>
        <select
          value={draft.tipo ?? ''}
          onChange={e => setDraft(d => ({ ...d, tipo: e.target.value || undefined }))}
          style={inputStyle}
        >
          <option value="">Todos</option>
          <option value="buscando_vaga">Buscando vaga</option>
          <option value="oferecendo_vaga">Oferecendo vaga</option>
        </select>
      </div>
      <button
        onClick={onApply}
        style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}
      >
        Aplicar
      </button>
      <button
        onClick={onClear}
        style={{ padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: C.card, color: C.muted, fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}
      >
        Limpar
      </button>
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}` }}>
      <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 800, color: C.text, margin: '0 0 16px' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── PainelTab ────────────────────────────────────────────────────────────────

export default function PainelTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [series, setSeries] = useState<SeriePonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState<AdminFiltros>({});
  const [draft, setDraft] = useState<AdminFiltros>({});

  const carregar = useCallback((f: AdminFiltros) => {
    setLoading(true);
    setErro('');
    getDashboard(f)
      .then(res => {
        setData(res);
        // Normaliza as três séries paralelas → SeriePonto[]
        const raw = res.series;
        const matches = raw?.matches_por_dia ?? [];
        const curtidas = raw?.curtidas_por_dia ?? [];
        const mensagens = raw?.mensagens_por_dia ?? [];
        setSeries(matches.map((m, i) => ({
          data: m.data,
          matches: m.total,
          curtidas: curtidas[i]?.total ?? 0,
          mensagens: mensagens[i]?.total ?? 0,
        })));
        setLoading(false);
      })
      .catch((e: Error) => {
        setErro(e instanceof ApiError ? e.message : 'Não foi possível conectar ao servidor.');
        setLoading(false);
      });
  }, []);

  useEffect(() => { carregar({}); }, [carregar]);

  const handleApply = () => {
    setFiltros(draft);
    carregar(draft);
  };

  const handleClear = () => {
    const empty: AdminFiltros = {};
    setDraft(empty);
    setFiltros(empty);
    carregar(empty);
  };

  // ── loading ──
  if (loading) return <SkeletonDash />;

  // ── error ──
  if (erro) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', gap: '16px' }}>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, textAlign: 'center' }}>{erro}</p>
        <button
          onClick={() => carregar(filtros)}
          style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: C.primary, color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── empty ──
  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
        Sem dados para o período selecionado.
      </div>
    );
  }

  const hasData = series.length > 0 || (data.kpis.matches_total ?? 0) > 0 || (data.kpis.usuarios_total ?? 0) > 0;
  const vazio = !hasData;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter bar */}
      <FilterBar draft={draft} setDraft={setDraft} onApply={handleApply} onClear={handleClear} />

      {/* Filtros aplicados info */}
      {Object.keys(data.filtros_aplicados).length > 0 && (
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, margin: 0 }}>
          Filtros ativos:{' '}
          {Object.entries(data.filtros_aplicados).map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </p>
      )}

      {vazio ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
          Sem dados para o período selecionado.
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {KPI_DEFS.map(({ key, label, fmt }) => (
              <div key={key} style={{
                background: C.card, borderRadius: '16px', padding: '18px 20px',
                border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, fontWeight: 600 }}>
                  {label}
                </span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, lineHeight: 1 }}>
                  {fmtKpi(data.kpis[key] as number, fmt)}
                </span>
              </div>
            ))}
          </div>

          {/* Line chart */}
          {series.length > 0 && (
            <SectionCard title="Atividade diária">
              <LineAreaChart series={series} title="Atividade diária — matches, curtidas e mensagens por dia" />
            </SectionCard>
          )}

          {/* Bottom row: top regiões + score dist */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {data.top_regioes.length > 0 && (
              <SectionCard title="Top regiões">
                <HorizontalBars data={data.top_regioes} title="Top regiões — perfis, matches e score médio" />
              </SectionCard>
            )}
            {data.distribuicao_score.length > 0 && (
              <SectionCard title="Distribuição de score">
                <ScoreDistChart data={data.distribuicao_score} title="Distribuição de score de compatibilidade por faixa" />
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
