import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import HelixScene from '../components/HelixScene';
import Stat from '../components/Stat';
import { DOMAIN_COLOUR, api, platform, type PlatformOverview } from '../lib/api';
import { reducedMotion, useReveal } from '../lib/motion';

const PIPELINE = [
  { n: '01', t: 'Ingest and clean', d: 'Any binary-outcome biomedical table. Constant columns dropped, missing cells imputed from the training split, noisy tails clipped, everything normalised.' },
  { n: '02', t: 'Select and reduce', d: 'Features ranked by mutual information, then projected by PCA onto as many components as there are qubits — the classical front-end of the hybrid architecture.' },
  { n: '03', t: 'Encode', d: 'Components rescaled to [0, π] and prepared as an entangled register through a ZZFeatureMap, computed as batched statevector algebra.' },
  { n: '04', t: 'Train six models', d: 'Logistic regression, random forest and an RBF SVM classically; a quantum-kernel SVM, a variational classifier and a data re-uploading QNN on the encoded state.' },
  { n: '05', t: 'Decide, or decline', d: 'A validation-weighted ensemble, a risk tier, a tunable operating point, and a conformal predictor that abstains instead of guessing.' },
];

export default function Landing() {
  const scope = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const [ov, setOv] = useState<PlatformOverview | null>(null);
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    platform.overview().then(setOv).catch(() => {});
    api.metrics().then(setM).catch(() => {});
  }, []);
  useReveal(scope, [ov, m]);

  useEffect(() => {
    if (reducedMotion() || !hero.current) return;
    const q = gsap.utils.selector(hero);
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(q('.h-eyebrow'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 })
      .fromTo(q('.h-line'), { opacity: 0, y: 44 },
              { opacity: 1, y: 0, duration: 1, stagger: 0.09 }, '-=0.3')
      .fromTo(q('.h-lede'), { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.8 }, '-=0.55')
      .fromTo(q('.h-cta'), { opacity: 0, y: 18 },
              { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, '-=0.5')
      .fromTo(q('.h-canvas'), { opacity: 0, scale: 0.94 },
              { opacity: 1, scale: 1, duration: 1.6 }, 0.15);
    return () => { tl.kill(); };
  }, []);

  const totalSamples = (ov?.catalogue ?? []).reduce((a, d) => a + d.n_samples, 0);
  const quantumWins = (ov?.comparison ?? []).filter((c) => c.quantum > c.classical).length;

  return (
    <div ref={scope}>
      {/* ---------------- hero ---------------- */}
      <section ref={hero} style={{ position: 'relative', minHeight: '100svh',
                                   display: 'flex', alignItems: 'center' }}>
        <div className="h-canvas hero-canvas">
          <HelixScene className="helix-hero" />
        </div>

        <div className="wrap hero-copy" style={{ position: 'relative', zIndex: 1,
                                                 paddingTop: 90 }}>
          <p className="eyebrow h-eyebrow">
            Smart India Hackathon 2026 · PS 26139 · MedTech / BioTech / HealthTech
          </p>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 6.6vw, 92px)', maxWidth: '15ch' }}>
            <span className="h-line" style={{ display: 'block' }}>A hybrid quantum</span>
            <span className="h-line" style={{ display: 'block' }}>platform for</span>
            <span className="h-line" style={{ display: 'block' }}>
              early <em style={{ fontStyle: 'italic', color: 'var(--violet-soft)' }}>detection</em>.
            </span>
          </h1>
          <p className="lede h-lede" style={{ marginTop: 26 }}>
            One pipeline — cleaning, encoding, six models, calibrated abstention —
            applied across cancer, cardiovascular, neurological and metabolic
            datasets. Upload your own and it trains on that too.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 34, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary h-cta" to="/detect">Run a detection</Link>
            <Link className="btn h-cta" to="/studio">Train on your own data</Link>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, zIndex: 1 }}>
          <div className="wrap mono" style={{ fontSize: 10, letterSpacing: '.2em',
                                              textTransform: 'uppercase',
                                              color: 'var(--ink-faint)' }}>
            Scroll
          </div>
        </div>
      </section>

      {/* ---------------- stat band ---------------- */}
      <section style={{ borderTop: '1px solid var(--line-soft)',
                        borderBottom: '1px solid var(--line-soft)' }}>
        <div className="wrap" style={{ padding: '54px 0' }}>
          <div className="grid cols-4 reveal">
            <Stat value={ov?.catalogue.length ?? 0} label="Diseases covered out of the box"
                  note="cancer · cardiovascular · neurological · metabolic" />
            <Stat value={totalSamples} label="Patient records across the catalogue"
                  note="genomics, imaging, records and voice" />
            <Stat value={6} label="Models trained per dataset"
                  note="three classical, three quantum" />
            <Stat value={quantumWins} label="Datasets where quantum beats classical"
                  note="measured, not assumed" />
          </div>
        </div>
      </section>

      {/* ---------------- catalogue ---------------- */}
      <section className="section">
        <div className="wrap">
          <p className="eyebrow reveal">The catalogue</p>
          <h2 className="display reveal" style={{ fontSize: 'clamp(28px, 4vw, 48px)',
                                                  maxWidth: '20ch', marginBottom: 26 }}>
            The same stack, four clinical domains and one genomics case study.
          </h2>
          <div className="grid cols-3" style={{ gap: 18 }}>
            {(ov?.catalogue ?? []).map((d) => (
              <Link key={d.id} to={`/detect?dataset=${d.id}`} className="panel reveal">
                <span className="chip" style={{
                  borderColor: `${DOMAIN_COLOUR[d.domain]}66`,
                  color: DOMAIN_COLOUR[d.domain],
                  background: `${DOMAIN_COLOUR[d.domain]}18` }}>{d.domain}</span>
                <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 24,
                             margin: '14px 0 8px', lineHeight: 1.15 }}>{d.disease}</h3>
                <p style={{ fontSize: 12.8, color: 'var(--ink-dim)', margin: 0 }}>
                  {d.description}
                </p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)',
                                             marginTop: 12, marginBottom: 0 }}>
                  {d.n_samples.toLocaleString()} × {d.n_features} · {d.modality.toUpperCase()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- pipeline ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="eyebrow reveal">How a detection is made</p>
          <div className="grid" style={{ gap: 18, marginTop: 24,
                                         gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {PIPELINE.map((s) => (
              <div key={s.n} className="panel reveal" style={{ minHeight: 210 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--violet-soft)' }}>
                  {s.n}
                </div>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400,
                             margin: '12px 0 9px' }}>{s.t}</h3>
                <p style={{ fontSize: 12.6, color: 'var(--ink-dim)', margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- contributions ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="eyebrow reveal">What this build contributes</p>
          <div className="grid cols-3" style={{ gap: 22, marginTop: 26 }}>
            <article className="panel reveal">
              <span className="chip chip-quantum">diagnostic</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
                           margin: '16px 0 10px' }}>
                It tells you when quantum <em>won't</em> help
              </h3>
              <p style={{ fontSize: 13.2, color: 'var(--ink-dim)' }}>
                Before training anything, the platform sweeps the quantum kernel
                across register widths and measures how fast its off-diagonal
                spread collapses. On these datasets it halves with every qubit
                added — the exponential concentration that makes a quantum kernel
                useless — and that is reported up front rather than discovered
                after the fact.
              </p>
            </article>
            <article className="panel reveal">
              <span className="chip chip-benign">honesty</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
                           margin: '16px 0 10px' }}>A model that can abstain</h3>
              <p style={{ fontSize: 13.2, color: 'var(--ink-dim)' }}>
                Conformal prediction gives a distribution-free coverage guarantee,
                and where the calibration set is too small to support it the
                platform says so. Every dataset also gets a risk ladder whose
                bands are checked against the observed outcome rate.
              </p>
            </article>
            <article className="panel reveal">
              <span className="chip chip-warn">speed</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
                           margin: '16px 0 10px' }}>Quantum kernels in closed form</h3>
              <p style={{ fontSize: 13.2, color: 'var(--ink-dim)' }}>
                Under statevector simulation the fidelity kernel has an exact
                closed form, so states are prepared once instead of once per
                pair — O(n) rather than O(n²)
                {m?.quantum && <>, matching Qiskit to{' '}
                  {Number(m.quantum.kernel_max_deviation_vs_qiskit).toExponential(0)}</>}.
                That is what makes both the diagnostic sweep and browser-speed
                training possible.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- genomics case study ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="panel reveal" style={{ padding: 'clamp(26px, 4vw, 48px)' }}>
            <div className="grid cols-2" style={{ gap: 40, alignItems: 'center' }}>
              <div>
                <span className="chip chip-quantum">deep dive</span>
                <h2 className="display" style={{ fontSize: 'clamp(26px, 3.4vw, 42px)',
                                                 margin: '16px 0 12px' }}>
                  A genomics case study, taken all the way down.
                </h2>
                <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
                  The BRCA1/BRCA2 dataset gets the full treatment: HGVS parsing,
                  Grantham chemistry, functional-domain mapping, a corrected
                  evaluation that removes ClinVar's duplicate assembly rows — and
                  a resolver that scores the{' '}
                  {m?.dataset ? m.dataset.n_vus.toLocaleString() : 'thousands of'}{' '}
                  variants ClinVar still calls uncertain.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                  <Link className="btn btn-primary" to="/genomics">Open the deep-dive</Link>
                  <Link className="btn" to="/resolver">The VUS Resolver</Link>
                </div>
              </div>
              <div className="grid cols-2" style={{ gap: 14 }}>
                {[
                  { v: m ? m.dataset.n_labelled.toLocaleString() : '—', l: 'Classified variants' },
                  { v: m ? m.dataset.n_vus.toLocaleString() : '—', l: 'Unresolved, scored' },
                  { v: m ? `${m.leakage.inflation_points.toFixed(1)} pts` : '—',
                    l: 'Accuracy removed by fixing the split' },
                  { v: m ? `${(m.conformal.accuracy_on_confident_calls * 100).toFixed(1)}%` : '—',
                    l: 'Accuracy when it commits' },
                ].map((k) => (
                  <div key={k.l} style={{ padding: '14px 16px', borderRadius: 12,
                                          border: '1px solid var(--line-soft)' }}>
                    <div className="mono" style={{ fontSize: 21 }}>{k.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 5 }}>{k.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- cta ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="panel reveal" style={{
            padding: 'clamp(30px, 5vw, 66px)', textAlign: 'center',
            background: 'linear-gradient(140deg, rgba(124,92,255,.14), rgba(34,211,238,.07))',
          }}>
            <h2 className="display" style={{ fontSize: 'clamp(30px, 4.6vw, 56px)' }}>
              Point it at your own data.
            </h2>
            <p className="lede" style={{ margin: '18px auto 28px' }}>
              Upload a CSV with a binary outcome column. The platform profiles it,
              trains all six models, benchmarks them and tells you whether the
              quantum half was worth it.
            </p>
            <Link className="btn btn-primary" to="/studio">Open the studio</Link>
          </div>
        </div>
      </section>

      <style>{`
        .hero-canvas {
          position: absolute;
          inset: 0 0 0 46%;
          z-index: 0;
          mask-image: linear-gradient(90deg, transparent, #000 22%, #000 82%, transparent),
                      linear-gradient(180deg, transparent, #000 15%);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%, #000 82%, transparent),
                              linear-gradient(180deg, transparent, #000 15%);
          mask-composite: intersect;
          -webkit-mask-composite: source-in;
        }
        .helix-hero { width: 100%; height: 100svh; }
        .hero-copy { max-width: min(1240px, calc(100% - 48px)); }
        @media (max-width: 1080px) { .hero-canvas { inset: 0 0 0 40%; opacity: .8; } }
        @media (max-width: 820px) {
          .hero-canvas {
            inset: 0; opacity: .28;
            mask-image: radial-gradient(60% 50% at 70% 30%, #000, transparent 75%);
            -webkit-mask-image: radial-gradient(60% 50% at 70% 30%, #000, transparent 75%);
          }
        }
      `}</style>
    </div>
  );
}
