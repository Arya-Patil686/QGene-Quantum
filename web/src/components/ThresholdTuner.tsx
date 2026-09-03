import { useMemo, useState } from 'react';
import type { ThresholdRow } from '../lib/api';
import { INK_FAINT, SERIES } from './charts';

/**
 * Decision-support control: move the operating threshold and watch sensitivity
 * trade against specificity. Screening and confirmation want opposite corners
 * of this curve, which is why the platform exposes it rather than fixing 0.5.
 */
export default function ThresholdTuner({ rows, positiveLabel, onChange }: {
  rows: ThresholdRow[];
  positiveLabel: string;
  onChange?: (t: number) => void;
}) {
  const youdenBest = useMemo(
    () => rows.reduce((a, b) => (b.youden > a.youden ? b : a), rows[0]),
    [rows]);
  const [t, setT] = useState(() => youdenBest?.threshold ?? 0.5);

  const row = useMemo(() => {
    let best = rows[0];
    rows.forEach((r) => {
      if (Math.abs(r.threshold - t) < Math.abs(best.threshold - t)) best = r;
    });
    return best;
  }, [rows, t]);

  const set = (v: number) => { setT(v); onChange?.(v); };

  const W = 620, H = 190, M = { t: 12, r: 96, b: 34, l: 42 };
  const sx = (v: number) => M.l + v * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - v * (H - M.t - M.b);
  const line = (key: 'sensitivity' | 'specificity' | 'precision') =>
    rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.threshold).toFixed(1)},${sy(r[key]).toFixed(1)}`).join(' ');

  const curves: [string, 'sensitivity' | 'specificity' | 'precision', string][] = [
    ['Sensitivity', 'sensitivity', SERIES[3]],
    ['Specificity', 'specificity', SERIES[1]],
    ['Precision', 'precision', SERIES[0]],
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
           style={{ display: 'block', overflow: 'visible' }} role="img"
           aria-label="Sensitivity and specificity against decision threshold">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)}
                  stroke="rgba(255,255,255,0.07)" />
            <text x={M.l - 8} y={sy(v) + 3.5} textAnchor="end" fill={INK_FAINT}
                  fontSize={9.5} fontFamily="var(--mono)">{v.toFixed(2)}</text>
          </g>
        ))}
        {curves.map(([, key, colour]) => (
          <path key={key} d={line(key)} fill="none" stroke={colour} strokeWidth={2} />
        ))}
        {/* nudge the end labels apart: the three curves often meet at the edge */}
        {(() => {
          const rows = curves
            .map(([label, key, colour]) => ({ label, colour, y: sy(row[key]) }))
            .sort((a, b) => a.y - b.y);
          for (let i = 1; i < rows.length; i++) {
            if (rows[i].y - rows[i - 1].y < 12) rows[i].y = rows[i - 1].y + 12;
          }
          const over = rows[rows.length - 1].y - (H - M.b);
          if (over > 0) rows.forEach((r) => { r.y -= over; });
          return rows.map((r) => (
            <text key={r.label} x={W - M.r + 8} y={r.y + 3.5} fill={r.colour}
                  fontSize={10} fontFamily="var(--mono)">{r.label}</text>
          ));
        })()}
        <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b}
              stroke="#ffffff" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={sx(t)} y={M.t - 1} textAnchor="middle" fill="#fff" fontSize={10}
              fontFamily="var(--mono)">{t.toFixed(2)}</text>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={sx(v)} y={H - M.b + 16} textAnchor="middle"
                fill={INK_FAINT} fontSize={9.5} fontFamily="var(--mono)">
            {v.toFixed(2)}
          </text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 3} textAnchor="middle" fill={INK_FAINT}
              fontSize={9} fontFamily="var(--mono)" letterSpacing="0.12em">
          DECISION THRESHOLD
        </text>
      </svg>

      <input type="range" min={0} max={1} step={0.01} value={t}
             onChange={(e) => set(Number(e.target.value))}
             aria-label="Decision threshold"
             style={{ width: '100%', padding: 0, marginTop: 10,
                      accentColor: 'var(--violet)', background: 'transparent',
                      border: 0 }} />

      <div className="grid cols-4" style={{ gap: 10, marginTop: 14 }}>
        {[
          { l: 'Sensitivity', v: row.sensitivity, c: SERIES[3] },
          { l: 'Specificity', v: row.specificity, c: SERIES[1] },
          { l: 'Precision', v: row.precision, c: SERIES[0] },
          { l: `Flagged as ${positiveLabel.toLowerCase()}`, v: row.flagged, c: 'var(--ink)' },
        ].map((k) => (
          <div key={k.l} style={{ padding: '11px 13px', borderRadius: 10,
                                  border: '1px solid var(--line-soft)' }}>
            <div className="mono" style={{ fontSize: 19, color: k.c }}>
              {(k.v * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-dim)', marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn" style={{ padding: '7px 14px', fontSize: 12 }}
                onClick={() => set(youdenBest.threshold)}>
          Balanced ({youdenBest.threshold.toFixed(2)})
        </button>
        <button className="btn" style={{ padding: '7px 14px', fontSize: 12 }}
                onClick={() => {
                  const r = [...rows].reverse().find((x) => x.sensitivity >= 0.95);
                  if (r) set(r.threshold);
                }}>
          Screening · 95% sensitivity
        </button>
        <button className="btn" style={{ padding: '7px 14px', fontSize: 12 }}
                onClick={() => {
                  const r = rows.find((x) => x.specificity >= 0.95);
                  if (r) set(r.threshold);
                }}>
          Confirmation · 95% specificity
        </button>
      </div>
    </div>
  );
}
