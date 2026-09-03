import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import HelixScene from '../components/HelixScene';
import Stat from '../components/Stat';
import { api } from '../lib/api';
import { reducedMotion, useReveal } from '../lib/motion';

const PIPELINE = [
  { n: '01', t: 'Annotate', d: 'The HGVS description is parsed into molecular features — consequence, protein position, functional domain, and the Grantham chemical distance of the substitution.' },
  { n: '02', t: 'Encode', d: 'Four principal components are mapped to rotation angles and prepared as a 4-qubit state through a ZZFeatureMap with full entanglement.' },
  { n: '03', t: 'Classify', d: 'Random Forest and SVM run classically; a quantum-kernel SVM and a variational classifier run on the encoded state. A fitted ensemble combines them.' },
  { n: '04', t: 'Decide, or decline', d: 'A conformal predictor either commits to a label with a coverage guarantee, or reports that both labels remain plausible.' },
];

export default function Landing() {
  const scope = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<any>(null);

  useEffect(() => { api.metrics().then(setM).catch(() => {}); }, []);
  useReveal(scope, [m]);

  useEffect(() => {
    if (reducedMotion() || !hero.current) return;
    const q = gsap.utils.selector(hero);
    // fromTo, not from: under StrictMode the effect runs twice, and `from`
    // would read the already-hidden state as the animation's end value.
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(q('.h-eyebrow'), { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.6 })
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

  const d = m?.dataset;
  const hybrid = m?.models?.hybrid;

  return (
    <div ref={scope}>
      {/* ---------------- hero ---------------- */}
      <section ref={hero} style={{ position: 'relative', minHeight: '100svh',
                                   display: 'flex', alignItems: 'center' }}>
        <div className="h-canvas hero-canvas">
          <HelixScene className="helix-hero" />
        </div>

        <div className="wrap hero-copy" style={{ position: 'relative', zIndex: 1, paddingTop: 90 }}>
          <p className="eyebrow h-eyebrow">
            Quantum machine learning · BRCA1 / BRCA2 · ClinVar
          </p>
          <h1 className="display" style={{ fontSize: 'clamp(44px, 7.4vw, 104px)', maxWidth: '15ch' }}>
            <span className="h-line" style={{ display: 'block' }}>Reading the meaning</span>
            <span className="h-line" style={{ display: 'block' }}>
              of a <em style={{ fontStyle: 'italic', color: 'var(--violet-soft)' }}>mutation</em>.
            </span>
          </h1>
          <p className="lede h-lede" style={{ marginTop: 26 }}>
            QGene classifies BRCA1 and BRCA2 variants as pathogenic or benign using a
            hybrid of classical and quantum models — and, unusually, is willing to say
            when it does not know.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 34, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary h-cta" to="/predict">Score a variant</Link>
            <Link className="btn h-cta" to="/resolver">Open the VUS Resolver</Link>
          </div>
        </div>

        <div style={{
          position: 'absolute', bottom: 26, left: 0, right: 0, zIndex: 1,
        }}>
          <div className="wrap mono" style={{ fontSize: 10, letterSpacing: '.2em',
                                              textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Scroll
          </div>
        </div>
      </section>

      {/* ---------------- stat band ---------------- */}
      <section style={{ borderTop: '1px solid var(--line-soft)',
                        borderBottom: '1px solid var(--line-soft)' }}>
        <div className="wrap" style={{ padding: '54px 0' }}>
          <div className="grid cols-4 reveal">
            <Stat value={d?.n_labelled ?? 0} label="Classified variants used for training"
                  note="ClinVar, one row per variant" />
            <Stat value={d?.n_vus ?? 0} label="Unresolved variants scored"
                  note="uncertain or conflicting" />
            <Stat value={(hybrid?.roc_auc ?? 0) * 100} decimals={1} suffix="%"
                  label="Hybrid ensemble ROC-AUC" note="held-out test set" />
            <Stat value={m?.quantum?.vqc_train_samples ?? 0}
                  label="Samples the VQC trains on" note="original QGene used 200" />
          </div>
        </div>
      </section>

      {/* ---------------- the problem ---------------- */}
      <section className="section">
        <div className="wrap grid cols-2" style={{ gap: 56, alignItems: 'start' }}>
          <div className="reveal">
            <p className="eyebrow">The gap this addresses</p>
            <h2 className="display" style={{ fontSize: 'clamp(30px, 4.4vw, 54px)', maxWidth: '16ch' }}>
              Most people who get a BRCA result get an answer nobody can interpret.
            </h2>
          </div>
          <div className="reveal" style={{ paddingTop: 8 }}>
            <p style={{ color: 'var(--ink-dim)', fontSize: 15.5 }}>
              A variant of uncertain significance is not a diagnosis and not an
              all-clear. It is a finding in the report with no interpretation
              attached — and in ClinVar, {d ? d.n_vus.toLocaleString() : 'thousands of'} BRCA1
              and BRCA2 variants currently sit in exactly that state, either
              explicitly uncertain or with submitters in open disagreement.
            </p>
            <p style={{ color: 'var(--ink-dim)', fontSize: 15.5 }}>
              Prediction tools normally discard these rows, because they carry no
              label to train against. QGene keeps them, scores every one, and ranks
              them by how much a laboratory would gain from resolving each — turning
              the awkward part of the dataset into the useful part.
            </p>
            <Link className="btn" to="/resolver" style={{ marginTop: 12 }}>
              See the ranked list →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- pipeline ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="eyebrow reveal">How a prediction is made</p>
          <div className="grid cols-4" style={{ gap: 22, marginTop: 26 }}>
            {PIPELINE.map((s) => (
              <div key={s.n} className="panel reveal" style={{ minHeight: 210 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--violet-soft)' }}>
                  {s.n}
                </div>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 25, fontWeight: 400,
                             margin: '14px 0 10px' }}>{s.t}</h3>
                <p style={{ fontSize: 13.2, color: 'var(--ink-dim)', margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- what is different ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="eyebrow reveal">What this build contributes</p>
          <div className="grid cols-3" style={{ gap: 22, marginTop: 26 }}>
            <article className="panel reveal">
              <span className="chip chip-warn">Correction</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 27, fontWeight: 400,
                           margin: '16px 0 10px' }}>An evaluation that holds up</h3>
              <p style={{ fontSize: 13.4, color: 'var(--ink-dim)' }}>
                ClinVar lists every variant once per genome assembly. Splitting rows
                instead of variants puts the same variant on both sides of the split.
                {m?.leakage && (
                  <> Repeating that mistake here inflates accuracy by{' '}
                    <strong style={{ color: 'var(--amber)' }}>
                      {m.leakage.inflation_points.toFixed(1)} points
                    </strong>. Every number on this site uses a variant-level split.</>
                )}
              </p>
            </article>
            <article className="panel reveal">
              <span className="chip chip-quantum">Speed</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 27, fontWeight: 400,
                           margin: '16px 0 10px' }}>Quantum kernels in closed form</h3>
              <p style={{ fontSize: 13.4, color: 'var(--ink-dim)' }}>
                Under statevector simulation the fidelity kernel has an exact closed
                form, so states are prepared once rather than once per pair. The Gram
                matrix drops from O(n²) circuit simulations to O(n)
                {m?.quantum && <> — {m.quantum.qsvm_train_samples.toLocaleString()}²
                  entries in {m.quantum.gram_matrix_seconds}s, matching Qiskit to{' '}
                  {Number(m.quantum.kernel_max_deviation_vs_qiskit).toExponential(0)}</>}.
              </p>
            </article>
            <article className="panel reveal">
              <span className="chip chip-benign">Honesty</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 27, fontWeight: 400,
                           margin: '16px 0 10px' }}>A model that can abstain</h3>
              <p style={{ fontSize: 13.4, color: 'var(--ink-dim)' }}>
                Conformal prediction gives a distribution-free coverage guarantee:
                the true label is inside the returned set at the stated rate.
                {m?.conformal && (
                  <> Targeting {Math.round(m.conformal.target_coverage * 100)}%, it
                    achieves {(m.conformal.empirical_coverage * 100).toFixed(1)}% and
                    declines to call{' '}
                    {(m.conformal.abstention_rate * 100).toFixed(0)}% of cases.</>
                )}
              </p>
            </article>
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
              Try it on a real variant.
            </h2>
            <p className="lede" style={{ margin: '18px auto 28px' }}>
              Paste any BRCA1 or BRCA2 HGVS description, or start from one of the
              founder variants. You will see the quantum state it produces, not just
              a number.
            </p>
            <Link className="btn btn-primary" to="/predict">Open the predictor</Link>
          </div>
        </div>
      </section>

      <style>{`
        .hero-canvas {
          position: absolute;
          inset: 0 0 0 46%;
          z-index: 0;
          /* fade at the left so the headline stays clean, and at the top so the
             navigation stays legible over the animation */
          mask-image: linear-gradient(90deg, transparent, #000 22%, #000 82%, transparent),
                      linear-gradient(180deg, transparent, #000 15%);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%, #000 82%, transparent),
                              linear-gradient(180deg, transparent, #000 15%);
          mask-composite: intersect;
          -webkit-mask-composite: source-in;
        }
        .helix-hero { width: 100%; height: 100svh; }
        .hero-copy { max-width: min(1240px, calc(100% - 48px)); }

        @media (max-width: 1080px) {
          .hero-canvas { inset: 0 0 0 40%; opacity: .8; }
        }
        @media (max-width: 820px) {
          .hero-canvas {
            inset: 0;
            opacity: .28;
            mask-image: radial-gradient(60% 50% at 70% 30%, #000, transparent 75%);
            -webkit-mask-image: radial-gradient(60% 50% at 70% 30%, #000, transparent 75%);
          }
        }
      `}</style>
    </div>
  );
}
