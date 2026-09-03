import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reducedMotion } from '../lib/motion';

/**
 * A number that counts up when it scrolls into view.
 *
 * The value lives in state, not in an imperative textContent write, so an
 * unrelated re-render cannot reconcile the readout back to zero.
 */
export default function Stat({ value, decimals = 0, suffix = '', label, note }: {
  value: number; decimals?: number; suffix?: string; label: string; note?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));

  useEffect(() => {
    if (reducedMotion() || !ref.current) { setShown(value); return; }
    const o = { v: 0 };
    const tw = gsap.to(o, {
      v: value, duration: 1.5, ease: 'power2.out',
      onUpdate: () => setShown(o.v),
      scrollTrigger: { trigger: ref.current, start: 'top 94%', once: true },
    });
    return () => {
      tw.scrollTrigger?.kill();
      tw.kill();
    };
  }, [value]);

  useEffect(() => { ScrollTrigger.refresh(); }, [value]);

  return (
    <div>
      <div ref={ref} className="mono"
           style={{ fontSize: 'clamp(30px, 4vw, 46px)', letterSpacing: '-0.03em',
                    color: 'var(--ink)', lineHeight: 1.05 }}>
        {shown.toLocaleString(undefined, {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals,
        })}{suffix}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 8 }}>{label}</div>
      {note && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>
          {note}
        </div>
      )}
    </div>
  );
}
