import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { reducedMotion } from '../lib/motion';

const R = 78;
const C = 2 * Math.PI * R;

/**
 * Semi-circular gauge: benign to the left, pathogenic to the right.
 *
 * The animated value is held in React state rather than written straight to
 * the DOM. Writing imperatively works until an unrelated re-render reconciles
 * the text node back to its JSX value, at which point the readout silently
 * resets — so progress drives the render instead.
 */
export default function ProbabilityDial({ p, label }: { p: number; label: string }) {
  const [t, setT] = useState(() => (reducedMotion() ? 1 : 0));

  useEffect(() => {
    if (reducedMotion()) { setT(1); return; }
    const o = { v: 0 };
    const tw = gsap.to(o, {
      v: 1, duration: 1.25, ease: 'power3.out',
      onUpdate: () => setT(o.v),
    });
    return () => { tw.kill(); };
  }, [p]);

  const shown = p * t;
  const pathogenic = p > 0.5;
  const colour = pathogenic ? '#ff4d6d' : '#34d399';

  return (
    <div style={{ width: 200, margin: '0 auto' }}>
      <div style={{ position: 'relative', height: 104 }}>
      <svg width="200" height="104" viewBox="0 0 200 104" aria-hidden="true">
        <g transform="translate(100,96) rotate(180)">
          <circle r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"
                  strokeDasharray={`${C * 0.5} ${C}`} strokeLinecap="round" />
          <circle r={R} fill="none" stroke={colour} strokeWidth="10"
                  strokeDasharray={`${C * 0.5} ${C}`}
                  strokeDashoffset={C * (1 - shown * 0.5)}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 10px ${colour}88)` }} />
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 'auto 0 14px', textAlign: 'center' }}>
        <div className="mono"
             style={{ fontSize: 31, letterSpacing: '-0.03em', color: colour, lineHeight: 1 }}>
          {(shown * 100).toFixed(1)}%
        </div>
      </div>
      </div>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.16em', marginTop: 6,
                                     textTransform: 'uppercase', color: 'var(--ink-faint)',
                                     textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}
