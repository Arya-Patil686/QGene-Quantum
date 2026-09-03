import type { PipelineStage } from '../lib/api';

const ICONS: Record<string, string> = {
  clean: 'M4 7h16M4 12h10M4 17h6',
  impute: 'M12 3v18M4 12h16',
  denoise: 'M3 12c3-6 6 6 9 0s6-6 9 0',
  normalise: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  select: 'M4 6h16M7 12h10M10 18h4',
  reduce: 'M4 4h7v7H4zM15 15h5v5h-5z',
  encode: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8M8 12h8',
};

/** The pre-processing chain, with the feature count at each step. */
export default function PipelineFlow({ stages }: { stages: PipelineStage[] }) {
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {stages.map((s, i) => (
        <div key={s.stage} style={{ display: 'grid',
                                    gridTemplateColumns: '38px 1fr auto',
                                    gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              border: '1px solid var(--line)', display: 'grid',
              placeItems: 'center',
              background: i === stages.length - 1
                ? 'linear-gradient(140deg, rgba(124,92,255,.3), rgba(34,211,238,.18))'
                : 'rgba(255,255,255,0.04)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke={i === stages.length - 1 ? '#c9bcff' : '#8f8fc4'}
                   strokeWidth="1.6" strokeLinecap="round">
                <path d={ICONS[s.stage] ?? ICONS.clean} />
              </svg>
            </div>
            {i < stages.length - 1 && (
              <div style={{ width: 1, flex: 1, minHeight: 26,
                            background: 'linear-gradient(180deg, var(--line), transparent)' }} />
            )}
          </div>
          <div style={{ paddingBottom: 20 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '.12em',
                                           textTransform: 'uppercase',
                                           color: 'var(--ink)' }}>{s.stage}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 4 }}>
              {s.detail}
            </div>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)',
                                         whiteSpace: 'nowrap', paddingTop: 2 }}>
            {s.n_features}f
          </div>
        </div>
      ))}
    </div>
  );
}
