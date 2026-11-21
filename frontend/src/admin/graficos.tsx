import type { SeriePonto, TopRegiao, DistribuicaoScore } from '../api';
import { C, FONTE_TEXTO, diaMesBR, numeroBR } from '../ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function niceMax(val: number): number {
  if (val <= 0) return 10;
  const exp = Math.floor(Math.log10(val));
  const mag = Math.pow(10, exp);
  return Math.ceil(val / mag) * mag;
}

function yTicks(max: number, n = 5): number[] {
  const step = max / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(step * i));
}

// ─── Line/Area Chart ──────────────────────────────────────────────────────────

const LINE_SERIES = [
  { key: 'matches' as const, color: C.mintDark, label: 'Matches' },
  { key: 'curtidas' as const, color: C.primary, label: 'Curtidas' },
  { key: 'mensagens' as const, color: C.muted, label: 'Mensagens' },
];

export function LineAreaChart({ series, title }: { series: SeriePonto[]; title: string }) {
  if (!series.length) return null;

  const ML = 52, MR = 24, MT = 18, MB = 58;
  const W = 640, H = 268;
  const CW = W - ML - MR;
  const CH = H - MT - MB;

  const allVals = series.flatMap(p => [p.matches, p.curtidas, p.mensagens]);
  const maxVal = niceMax(Math.max(...allVals, 1));
  const ticks = yTicks(maxVal);

  const n = series.length;
  const xOf = (i: number) => ML + (n <= 1 ? CW / 2 : i * CW / (n - 1));
  const yOf = (v: number) => MT + CH - Math.max(0, (v / maxVal) * CH);

  const step = Math.max(1, Math.ceil(n / 10));
  const xLabels = series
    .map((p, i) => ({ i, label: diaMesBR(p.data) }))
    .filter((_, i) => i % step === 0 || i === n - 1);

  const pathsData = LINE_SERIES.map(({ key, color, label }) => {
    const pts = series.map((p, i) => [xOf(i), yOf(p[key])] as [number, number]);
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const bottom = MT + CH;
    const area =
      `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ` +
      pts.slice(1).map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
      ` L ${pts[pts.length - 1][0].toFixed(1)},${bottom} L ${pts[0][0].toFixed(1)},${bottom} Z`;
    return { key, color, label, line, area };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: '860px', display: 'block', margin: '0 auto' }}
      aria-label={title}
      role="img"
    >
      <title>{title}</title>

      {/* Y grid + labels */}
      {ticks.map(tick => (
        <g key={tick}>
          <line
            x1={ML} y1={yOf(tick)} x2={ML + CW} y2={yOf(tick)}
            stroke={C.border} strokeWidth="1"
          />
          <text
            x={ML - 6} y={yOf(tick) + 4}
            textAnchor="end" fontSize="11" fill={C.muted} fontFamily={FONTE_TEXTO}
          >
            {tick.toLocaleString('pt-BR')}
          </text>
        </g>
      ))}

      {/* X axis */}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke={C.border} strokeWidth="1.5" />

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text
          key={i} x={xOf(i)} y={MT + CH + 16}
          textAnchor="middle" fontSize="11" fill={C.muted} fontFamily={FONTE_TEXTO}
        >
          {label}
        </text>
      ))}

      {/* Area fills */}
      {pathsData.map(({ key, color, area }) => (
        <path key={`a-${key}`} d={area} fill={color} fillOpacity="0.1" />
      ))}

      {/* Lines */}
      {pathsData.map(({ key, color, line }) => (
        <path
          key={`l-${key}`} d={line} fill="none"
          stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        />
      ))}

      {/* Legend */}
      {pathsData.map(({ key, color, label }, idx) => (
        <g key={`leg-${key}`} transform={`translate(${ML + idx * 140}, ${H - 14})`}>
          <rect width="12" height="12" rx="3" fill={color} />
          <text x="16" y="10" fontSize="11" fill={C.text} fontFamily={FONTE_TEXTO} fontWeight="600">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Horizontal Bars (Top Regiões) ────────────────────────────────────────────

export function HorizontalBars({ data, title }: { data: TopRegiao[]; title: string }) {
  if (!data.length) return null;

  const ML = 110, MR = 52, MT = 10;
  const W = 580;
  const ROW_H = 48;
  const BAR_H = 10;
  const CW = W - ML - MR;
  const H = data.length * ROW_H + MT + 24;

  const maxVal = Math.max(...data.flatMap(r => [r.perfis, r.matches]), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-label={title} role="img">
      <title>{title}</title>

      {/* Column header: Score médio dos matches */}
      <text x={W - 4} y={MT - 2} textAnchor="end" fontSize="10" fill={C.muted} fontFamily={FONTE_TEXTO}>
        Score médio dos matches
      </text>

      {data.map((r, i) => {
        const y = MT + i * ROW_H;
        const pw = Math.max((r.perfis / maxVal) * CW, 2);
        const mw = Math.max((r.matches / maxVal) * CW, 2);
        const label = r.regiao.length > 13 ? r.regiao.slice(0, 12) + '…' : r.regiao;
        return (
          <g key={r.regiao}>
            <text
              x={ML - 8} y={y + BAR_H + 4}
              textAnchor="end" fontSize="12" fill={C.text} fontFamily={FONTE_TEXTO} fontWeight="600"
            >
              {label}
            </text>
            {/* Perfis bar */}
            <rect x={ML} y={y} width={pw} height={BAR_H} rx="3" fill={C.primary} fillOpacity="0.85" />
            <text x={ML + pw + 4} y={y + 9} fontSize="11" fill={C.muted} fontFamily={FONTE_TEXTO}>
              {r.perfis}
            </text>
            {/* Matches bar */}
            <rect x={ML} y={y + BAR_H + 5} width={mw} height={BAR_H} rx="3" fill={C.mintDark} fillOpacity="0.85" />
            <text x={ML + mw + 4} y={y + BAR_H + 14} fontSize="10" fill={C.muted} fontFamily={FONTE_TEXTO}>
              {r.matches}
            </text>
            {/* Score médio */}
            <text
              x={W - 4} y={y + BAR_H + 4}
              textAnchor="end" fontSize="12" fill={C.text} fontFamily={FONTE_TEXTO} fontWeight="700"
            >
              {r.score_medio !== null ? `${numeroBR(Number(r.score_medio) * 100, 1)}%` : '—'}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${ML}, ${H - 10})`}>
        <rect width="10" height="10" rx="2" fill={C.primary} fillOpacity="0.85" />
        <text x="14" y="9" fontSize="10" fill={C.muted} fontFamily={FONTE_TEXTO}>Perfis</text>
        <rect x="52" width="10" height="10" rx="2" fill={C.mintDark} fillOpacity="0.85" />
        <text x="66" y="9" fontSize="10" fill={C.muted} fontFamily={FONTE_TEXTO}>Matches</text>
      </g>
    </svg>
  );
}

// ─── Score Distribution Bars ──────────────────────────────────────────────────

export function ScoreDistChart({ data, title }: { data: DistribuicaoScore[]; title: string }) {
  if (!data.length) return null;

  const ML = 32, MR = 16, MT = 20, MB = 44;
  const W = 480, H = 200;
  const CW = W - ML - MR;
  const CH = H - MT - MB;

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const barW = Math.max(Math.floor(CW / data.length) - 8, 10);
  const gap = (CW - barW * data.length) / (data.length + 1);

  const yTks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-label={title} role="img">
      <title>{title}</title>

      {/* Y grid */}
      {yTks.map((tick, ti) => {
        const y = MT + CH - (tick / maxVal) * CH;
        return (
          <g key={ti}>
            <line x1={ML} y1={y} x2={ML + CW} y2={y} stroke={C.border} strokeWidth="1" />
            <text x={ML - 4} y={y + 4} textAnchor="end" fontSize="10" fill={C.muted} fontFamily={FONTE_TEXTO}>
              {tick}
            </text>
          </g>
        );
      })}

      {/* X axis */}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke={C.border} strokeWidth="1.5" />

      {data.map((d, i) => {
        const bh = Math.max((d.total / maxVal) * CH, 2);
        const x = ML + gap + i * (barW + gap);
        const y = MT + CH - bh;
        return (
          <g key={d.faixa}>
            <rect x={x} y={y} width={barW} height={bh} rx="4" fill={C.mintDark} fillOpacity="0.85" />
            {d.total > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle" fontSize="10" fill={C.text} fontFamily={FONTE_TEXTO} fontWeight="600"
              >
                {d.total}
              </text>
            )}
            <text
              x={x + barW / 2} y={MT + CH + 16}
              textAnchor="middle" fontSize="10" fill={C.muted} fontFamily={FONTE_TEXTO}
            >
              {d.faixa}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Linhas por número de workers (benchmark de paralelismo) ──────────────────

export interface SerieWorkers {
  rotulo: string;
  cor: string;
  pontos: { x: number; y: number }[];
  /** Linha de referência (sequencial, ideal): tracejada e sem marcadores. */
  referencia?: boolean;
  marcador?: 'circulo' | 'quadrado';
}

/**
 * Valor (eixo y) × workers (eixo x), uma linha por série. Rótulo do último ponto direto na linha e
 * legenda embaixo (a identidade nunca depende só da cor: marcadores diferentes e texto).
 */
export function GraficoWorkers({ series, titulo, rotuloY, formatarY }: {
  series: SerieWorkers[]; titulo: string; rotuloY: string; formatarY: (v: number) => string;
}) {
  const xs = Array.from(new Set(series.flatMap(s => s.pontos.map(p => p.x)))).sort((a, b) => a - b);
  if (!xs.length) return null;
  const ML = 56, MR = 74, MT = 16, MB = 64;
  const W = 520, H = 280;
  const CW = W - ML - MR, CH = H - MT - MB;
  // Passo "redondo" (1, 2, 2,5 ou 5 × 10^k) com no máximo 5 intervalos.
  const maior = Math.max(...series.flatMap(s => s.pontos.map(p => p.y)), 0.0001) * 1.05;
  const bruto = maior / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = ([1, 2, 2.5, 5, 10].find(f => f * mag >= bruto) ?? 10) * mag;
  const maxY = Math.ceil(maior / passo) * passo;
  const xOf = (x: number) => ML + (xs.length <= 1 ? CW / 2 : (xs.indexOf(x) * CW) / (xs.length - 1));
  const yOf = (y: number) => MT + CH - Math.max(0, Math.min(1, y / maxY)) * CH;
  const ticks = Array.from({ length: Math.round(maxY / passo) + 1 }, (_, i) => i * passo);

  // rótulos do último ponto sem sobreposição (afasta pelo menos 14 px)
  const finais = series.filter(s => !s.referencia && s.pontos.length)
    .map(s => ({ s, p: s.pontos[s.pontos.length - 1] }))
    .sort((a, b) => yOf(b.p.y) - yOf(a.p.y));
  const posRotulo = new Map<string, number>();
  let ultimo = Infinity;
  for (const { s, p } of finais) {
    const y = Math.min(yOf(p.y) + 4, ultimo - 14);
    posRotulo.set(s.rotulo, y);
    ultimo = y;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={titulo}>
      <title>{titulo}</title>
      {ticks.map(t => (
        <g key={t}>
          <line x1={ML} y1={yOf(t)} x2={ML + CW} y2={yOf(t)} stroke={C.border} strokeWidth="1" />
          <text x={ML - 6} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill={C.muted} fontFamily={FONTE_TEXTO}>{formatarY(t)}</text>
        </g>
      ))}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke={C.borderStrong} strokeWidth="1.5" />
      {xs.map(x => (
        <text key={x} x={xOf(x)} y={MT + CH + 18} textAnchor="middle" fontSize="12" fill={C.muted} fontFamily={FONTE_TEXTO}>{x}</text>
      ))}
      <text x={ML + CW / 2} y={MT + CH + 36} textAnchor="middle" fontSize="11" fill={C.muted} fontFamily={FONTE_TEXTO}>workers</text>
      <text x={14} y={MT + CH / 2} textAnchor="middle" fontSize="11" fill={C.muted} fontFamily={FONTE_TEXTO}
        transform={`rotate(-90 14 ${MT + CH / 2})`}>{rotuloY}</text>

      {series.map(s => {
        const d = s.pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(' ');
        return (
          <g key={s.rotulo}>
            <path d={d} fill="none" stroke={s.cor} strokeWidth={s.referencia ? 1.5 : 2.5} strokeDasharray={s.referencia ? '6 5' : undefined}
              strokeLinecap="round" strokeLinejoin="round" />
            {!s.referencia && s.pontos.map(p => s.marcador === 'quadrado'
              ? <rect key={p.x} x={xOf(p.x) - 5} y={yOf(p.y) - 5} width="10" height="10" rx="2" fill={s.cor} stroke={C.card} strokeWidth="2" />
              : <circle key={p.x} cx={xOf(p.x)} cy={yOf(p.y)} r="5.5" fill={s.cor} stroke={C.card} strokeWidth="2" />)}
            {!s.referencia && s.pontos.length > 0 && (
              <text x={xOf(s.pontos[s.pontos.length - 1].x) + 10} y={posRotulo.get(s.rotulo)} fontSize="11" fill={C.text}
                fontFamily={FONTE_TEXTO} fontWeight="700">{formatarY(s.pontos[s.pontos.length - 1].y)}</text>
            )}
          </g>
        );
      })}

      {series.map((s, i) => (
        <g key={`leg-${s.rotulo}`} transform={`translate(${ML + i * 118}, ${H - 12})`}>
          {s.referencia
            ? <line x1="0" y1="-4" x2="14" y2="-4" stroke={s.cor} strokeWidth="2" strokeDasharray="4 3" />
            : s.marcador === 'quadrado' ? <rect x="2" y="-9" width="10" height="10" rx="2" fill={s.cor} /> : <circle cx="7" cy="-4" r="5" fill={s.cor} />}
          <text x="18" y="0" fontSize="11" fill={C.text} fontFamily={FONTE_TEXTO} fontWeight="600">{s.rotulo}</text>
        </g>
      ))}
    </svg>
  );
}
