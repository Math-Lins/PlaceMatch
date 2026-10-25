import type { SeriePonto, TopRegiao, DistribuicaoScore } from '../api';

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
  { key: 'matches' as const, color: '#5DBF96', label: 'Matches' },
  { key: 'curtidas' as const, color: '#E06B45', label: 'Curtidas' },
  { key: 'mensagens' as const, color: '#8A7E78', label: 'Mensagens' },
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
    .map((p, i) => ({ i, label: p.data.slice(5).replace('-', '/') }))
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
      style={{ width: '100%', display: 'block' }}
      aria-label={title}
      role="img"
    >
      <title>{title}</title>

      {/* Y grid + labels */}
      {ticks.map(tick => (
        <g key={tick}>
          <line
            x1={ML} y1={yOf(tick)} x2={ML + CW} y2={yOf(tick)}
            stroke="#EDE8E3" strokeWidth="1"
          />
          <text
            x={ML - 6} y={yOf(tick) + 4}
            textAnchor="end" fontSize="11" fill="#8A7E78" fontFamily="Nunito,sans-serif"
          >
            {tick.toLocaleString('pt-BR')}
          </text>
        </g>
      ))}

      {/* X axis */}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#EDE8E3" strokeWidth="1.5" />

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text
          key={i} x={xOf(i)} y={MT + CH + 16}
          textAnchor="middle" fontSize="11" fill="#8A7E78" fontFamily="Nunito,sans-serif"
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
          <text x="16" y="10" fontSize="11" fill="#2A2420" fontFamily="Nunito,sans-serif" fontWeight="600">
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

      {/* Column header: Score médio */}
      <text x={W - 4} y={MT - 2} textAnchor="end" fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif">
        Score méd.
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
              textAnchor="end" fontSize="12" fill="#2A2420" fontFamily="Nunito,sans-serif" fontWeight="600"
            >
              {label}
            </text>
            {/* Perfis bar */}
            <rect x={ML} y={y} width={pw} height={BAR_H} rx="3" fill="#E06B45" fillOpacity="0.85" />
            <text x={ML + pw + 4} y={y + 9} fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif">
              {r.perfis}
            </text>
            {/* Matches bar */}
            <rect x={ML} y={y + BAR_H + 5} width={mw} height={BAR_H} rx="3" fill="#5DBF96" fillOpacity="0.85" />
            <text x={ML + mw + 4} y={y + BAR_H + 14} fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif">
              {r.matches}
            </text>
            {/* Score médio */}
            <text
              x={W - 4} y={y + BAR_H + 4}
              textAnchor="end" fontSize="12" fill="#2A2420" fontFamily="Nunito,sans-serif" fontWeight="700"
            >
              {r.score_medio !== null ? `${Number(r.score_medio).toFixed(0)}%` : '—'}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${ML}, ${H - 10})`}>
        <rect width="10" height="10" rx="2" fill="#E06B45" fillOpacity="0.85" />
        <text x="14" y="9" fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif">Perfis</text>
        <rect x="52" width="10" height="10" rx="2" fill="#5DBF96" fillOpacity="0.85" />
        <text x="66" y="9" fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif">Matches</text>
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
            <line x1={ML} y1={y} x2={ML + CW} y2={y} stroke="#EDE8E3" strokeWidth="1" />
            <text x={ML - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif">
              {tick}
            </text>
          </g>
        );
      })}

      {/* X axis */}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#EDE8E3" strokeWidth="1.5" />

      {data.map((d, i) => {
        const bh = Math.max((d.total / maxVal) * CH, 2);
        const x = ML + gap + i * (barW + gap);
        const y = MT + CH - bh;
        return (
          <g key={d.faixa}>
            <rect x={x} y={y} width={barW} height={bh} rx="4" fill="#5DBF96" fillOpacity="0.85" />
            {d.total > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle" fontSize="10" fill="#2A2420" fontFamily="Nunito,sans-serif" fontWeight="600"
              >
                {d.total}
              </text>
            )}
            <text
              x={x + barW / 2} y={MT + CH + 16}
              textAnchor="middle" fontSize="10" fill="#8A7E78" fontFamily="Nunito,sans-serif"
            >
              {d.faixa}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
