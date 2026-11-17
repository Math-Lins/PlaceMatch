import { useState, useEffect, useCallback } from 'react';
import { getDashboard, validarPeriodo, ApiError } from '../api';
import type { DashboardData, SeriePonto, AdminFiltros } from '../api';
import { LineAreaChart, HorizontalBars, ScoreDistChart } from './graficos';
import { C, FONTE_TITULO, FONTE_TEXTO, Botao, Campo, CamposPeriodo, BarraFiltros, EstadoCarregando, EstadoErro, EstadoVazio, estiloCampo, descreverFiltros, numeroBR } from '../ui';

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
  { key: 'score_medio',       label: 'Score médio dos matches', fmt: 'pct01' },
  { key: 'denuncias_pendentes', label: 'Denúncias pendentes', fmt: 'num' },
  { key: 'usuarios_suspensos',  label: 'Contas suspensas',    fmt: 'num' },
];

function fmtKpi(val: number | undefined | null, fmt: KpiFmt): string {
  if (val == null || isNaN(Number(val))) return '—';
  const n = Number(val);
  if (fmt === 'pct')   return `${numeroBR(n, 1)}%`;
  if (fmt === 'pct01') return `${numeroBR(n * 100, 1)}%`;
  return numeroBR(n);
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
  const erroPeriodo = validarPeriodo(draft.data_inicio, draft.data_fim);
  const campo = estiloCampo({ compacto: true });

  return (
    <BarraFiltros>
      <CamposPeriodo
        inicio={draft.data_inicio ?? ''} fim={draft.data_fim ?? ''} erro={erroPeriodo}
        onInicio={v => setDraft(d => ({ ...d, data_inicio: v || undefined }))}
        onFim={v => setDraft(d => ({ ...d, data_fim: v || undefined }))}
      />
      <Campo rotulo="Região" minWidth="160px">
        <input placeholder="Ex: Boa Viagem" value={draft.regiao ?? ''} onChange={e => setDraft(d => ({ ...d, regiao: e.target.value || undefined }))} style={campo} />
      </Campo>
      <Campo rotulo="Tipo" minWidth="170px">
        <select value={draft.tipo ?? ''} onChange={e => setDraft(d => ({ ...d, tipo: e.target.value || undefined }))} style={campo}>
          <option value="">Todos</option>
          <option value="buscando_vaga">Buscando vaga</option>
          <option value="oferecendo_vaga">Oferecendo vaga</option>
        </select>
      </Campo>
      <Botao tamanho="compacto" onClick={onApply}>Aplicar</Botao>
      <Botao tamanho="compacto" variante="neutro" onClick={onClear}>Limpar</Botao>
    </BarraFiltros>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}` }}>
      <h3 style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>
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
    if (validarPeriodo(draft.data_inicio, draft.data_fim)) return;
    setFiltros(draft);
    carregar(draft);
  };

  const handleClear = () => {
    const empty: AdminFiltros = {};
    setDraft(empty);
    setFiltros(empty);
    carregar(empty);
  };

  if (loading) return <EstadoCarregando texto="Carregando indicadores…" altura="320px" />;
  if (erro) return <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(filtros)} />;
  if (!data) return <EstadoVazio titulo="Sem dados para o período selecionado." />;

  const hasData = series.length > 0 || (data.kpis.matches_total ?? 0) > 0 || (data.kpis.usuarios_total ?? 0) > 0;
  const vazio = !hasData;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter bar */}
      <FilterBar draft={draft} setDraft={setDraft} onApply={handleApply} onClear={handleClear} />

      {/* Filtros aplicados info */}
      {Object.keys(data.filtros_aplicados).length > 0 && (
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '-8px 0 0' }}>
          Filtros ativos: {descreverFiltros(data.filtros_aplicados as Record<string, unknown>)}
        </p>
      )}

      {vazio ? (
        <EstadoVazio titulo="Sem dados para o período selecionado." descricao="Ajuste as datas ou limpe os filtros." />
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {KPI_DEFS.map(({ key, label, fmt }) => (
              <div key={key} style={{
                background: C.card, borderRadius: '16px', padding: '18px 20px',
                border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted, fontWeight: 700 }}>
                  {label}
                </span>
                <span style={{ fontFamily: FONTE_TITULO, fontSize: '28px', fontWeight: 800, color: C.text, lineHeight: 1 }}>
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
