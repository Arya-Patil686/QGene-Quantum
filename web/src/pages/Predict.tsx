import { useEffect, useRef, useState } from 'react';
import BatchPanel from '../components/BatchPanel';
import BlochSpheres from '../components/BlochSpheres';
import CircuitDiagram from '../components/CircuitDiagram';
import KernelSpace from '../components/KernelSpace';
import ProbabilityDial from '../components/ProbabilityDial';
import ProteinTrack from '../components/ProteinTrack';
import ShapChart from '../components/ShapChart';
import { api, pct, type PredictResult } from '../lib/api';
import { useReveal } from '../lib/motion';

const FLAG_STYLE: Record<string, string> = {
  low: 'chip-benign', moderate: 'chip-warn', high: 'chip-path',
};

function ModelBar({ name, value, accent }: { name: string; value: number; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '116px 1fr 54px',
                  gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>{name}</span>
      <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)',
                    overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: accent,
                      borderRadius: 4, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
      </div>
      <span className="mono" style={{ fontSize: 11, textAlign: 'right' }}>{pct(value)}</span>
    </div>
  );
}

export default function Predict() {
  const scope = useRef<HTMLDivElement>(null);
  const [hgvs, setHgvs] = useState('NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)');
  const [examples, setExamples] = useState<{ name: string; label: string; note: string }[]>([]);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [kernelPts, setKernelPts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.examples().then(setExamples).catch(() => {});
    api.metrics().then((m) => setKernelPts(m.kernel_points ?? [])).catch(() => {});
  }, []);

  useReveal(scope, [result]);

  const run = async (name?: string) => {
    const target = (name ?? hgvs).trim();
    if (!target) return;
    setBusy(true); setError(null);
    try {
      setResult(await api.predict({ name: target }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { run(); /* score the default example on first paint */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = result;
  const pathogenic = r?.prediction === 'Pathogenic';

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">Single variant</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '18ch' }}>
          Score a variant, and see the state it produces.
        </h1>

        {/* ---------- input ---------- */}
        <div className="panel" style={{ marginTop: 34 }}>
          <label htmlFor="hgvs">HGVS variant description</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input id="hgvs" value={hgvs} spellCheck={false}
                   onChange={(e) => setHgvs(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
                   style={{ flex: '1 1 340px' }}
                   placeholder="NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)" />
            <button className="btn btn-primary" onClick={() => run()} disabled={busy}>
              {busy ? 'Encoding…' : 'Predict'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            {examples.map((ex) => (
              <button key={ex.name} className="chip" title={ex.note}
                      onClick={() => { setHgvs(ex.name); run(ex.name); }}
                      style={{ cursor: 'pointer', background: 'transparent' }}>
                {ex.label}
              </button>
            ))}
          </div>

          {error && (
            <p style={{ color: 'var(--rose)', fontSize: 13, marginBottom: 0 }}>{error}</p>
          )}
        </div>

        {r && (
          <>
            {/* ---------- verdict ---------- */}
            <div className="grid cols-3" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal" style={{ textAlign: 'center' }}>
                <ProbabilityDial p={r.pathogenic_probability} label="pathogenic probability" />
                <div style={{ marginTop: 14 }}>
                  <span className={`chip ${pathogenic ? 'chip-path' : 'chip-benign'}`}>
                    {r.prediction}
                  </span>
                </div>
                <p className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)',
                                             marginTop: 12, marginBottom: 0 }}>
                  {r.latency_ms} MS · HYBRID {Math.round(r.weights.classical * 100)}C /
                  {' '}{Math.round(r.weights.quantum * 100)}Q
                </p>
              </div>

              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>
                  Conformal decision · {r.conformal.confidence_level}% coverage
                </p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 25, lineHeight: 1.25,
                            margin: '0 0 12px' }}>
                  {r.conformal.verdict}
                </p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {r.conformal.set.length === 0
                    ? <span className="chip chip-warn">abstained · empty set</span>
                    : r.conformal.set.map((s) => (
                        <span key={s} className={`chip ${s === 'Pathogenic' ? 'chip-path' : 'chip-benign'}`}>
                          {s}
                        </span>
                      ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                              gap: 10, marginTop: 16 }}>
                  {[
                    { l: 'Credibility', v: r.conformal.credibility,
                      h: 'how well the best-fitting label fits, against calibration' },
                    { l: 'Confidence', v: r.conformal.confidence,
                      h: 'how firmly the alternative label is excluded' },
                  ].map((k) => (
                    <div key={k.l} title={k.h}
                         style={{ padding: '10px 12px', borderRadius: 9,
                                  border: '1px solid var(--line-soft)' }}>
                      <div className="mono" style={{ fontSize: 17 }}>
                        {(k.v * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                        {k.l}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)',
                                             marginTop: 10, marginBottom: 0 }}>
                  CONFORMAL p · BENIGN {r.conformal.p_values.Benign?.toFixed(3)} ·
                  {' '}PATHOGENIC {r.conformal.p_values.Pathogenic?.toFixed(3)}
                </p>
                <p style={{ fontSize: 12.4, color: 'var(--ink-dim)', marginBottom: 0, marginTop: 12 }}>
                  {r.conformal.status === 'committed'
                    ? 'Exactly one label clears the calibrated threshold, so the model is committing to a call at this coverage level.'
                    : r.conformal.set.length === 2
                    ? 'Both labels remain inside the prediction set. The model is declining to choose rather than guessing.'
                    : 'Neither label clears the threshold. The point estimate still stands, but the model will not commit to it at this coverage level.'}
                </p>
              </div>

              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>Uncertainty</p>
                <span className={`chip ${FLAG_STYLE[r.uncertainty.flag]}`}>
                  {r.uncertainty.flag} uncertainty
                </span>
                <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  fontSize: 12, color: 'var(--ink-dim)' }}>
                      <span>Quantum–classical disagreement</span>
                      <span className="mono">{r.uncertainty.quantum_classical_disagreement.toFixed(3)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)',
                                  marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(1, r.uncertainty.quantum_classical_disagreement / 0.5) * 100}%`,
                                    height: '100%', background: 'var(--amber)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  fontSize: 12, color: 'var(--ink-dim)' }}>
                      <span>Distance from the boundary</span>
                      <span className="mono">{r.uncertainty.margin.toFixed(3)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)',
                                  marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.uncertainty.margin / 0.5) * 100}%`,
                                    height: '100%', background: 'var(--cyan)' }} />
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12.2, color: 'var(--ink-faint)', marginBottom: 0, marginTop: 14 }}>
                  When the classical and quantum branches diverge, the ensemble is
                  extrapolating. That divergence is measured, not hidden.
                </p>
              </div>
            </div>

            {/* ---------- annotation + models ---------- */}
            <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>What the variant is</p>
                <dl style={{ margin: 0, display: 'grid',
                             gridTemplateColumns: 'auto 1fr', gap: '10px 18px' }}>
                  {([
                    ['Gene', r.annotation.gene],
                    ['Consequence', r.annotation.consequence],
                    ['cDNA position', r.annotation.cdna_position || '—'],
                    ['Protein position', r.annotation.protein_position ?? '—'],
                    ['Amino acid change', r.annotation.aa_change ?? '—'],
                    ['Functional domain', r.annotation.domain ?? 'outside annotated domains'],
                    ['Grantham distance', r.annotation.grantham ?? '—'],
                    ['Intron offset', r.annotation.intron_offset ?? '—'],
                  ] as [string, React.ReactNode][]).map(([k, v]) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt className="mono" style={{ fontSize: 10.5, letterSpacing: '.08em',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--ink-faint)' }}>{k}</dt>
                      <dd className="mono" style={{ margin: 0, fontSize: 12.5 }}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div style={{ marginTop: 22 }}>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Position in the protein</p>
                  <ProteinTrack {...r.protein_track} />
                </div>
              </div>

              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 16 }}>
                  What each model said
                </p>
                <div style={{ display: 'grid', gap: 12 }}>
                  <ModelBar name="Random Forest" value={r.models.random_forest} accent="#8b8bd0" />
                  <ModelBar name="SVM (RBF)" value={r.models.svm} accent="#8b8bd0" />
                  <ModelBar name="QSVM" value={r.models.qsvm} accent="var(--violet)" />
                  <ModelBar name="VQC" value={r.models.vqc} accent="var(--violet)" />
                  <div className="rule" style={{ margin: '4px 0' }} />
                  <ModelBar name="Classical mean" value={r.models.classical_mean} accent="#5c6c9e" />
                  <ModelBar name="Quantum mean" value={r.models.quantum_mean} accent="#6f4fe0" />
                  <ModelBar name="Hybrid" value={r.models.hybrid} accent="var(--cyan)" />
                </div>
                {r.explanation && (
                  <div style={{ marginTop: 24 }}>
                    <p className="eyebrow" style={{ marginBottom: 12 }}>
                      Why — SHAP contributions
                    </p>
                    <ShapChart rows={r.explanation} />
                  </div>
                )}
              </div>
            </div>

            {/* ---------- quantum ---------- */}
            <div className="panel reveal" style={{ marginTop: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
                <p className="eyebrow" style={{ margin: 0 }}>
                  The quantum state this variant produces
                </p>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                  ENTANGLEMENT ENTROPY {r.quantum.entanglement_entropy.toFixed(3)} BITS
                </span>
              </div>

              <BlochSpheres vectors={r.quantum.bloch} />

              <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', maxWidth: '78ch' }}>
                Each sphere is one qubit's reduced state after encoding. A vector that
                falls short of the surface means that qubit is entangled with the
                others rather than holding an independent value — the entanglement is
                what the ZZ interactions build, and it is where a quantum kernel
                differs from a classical one.
              </p>

              <div className="grid cols-2" style={{ gap: 26, marginTop: 18 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>
                    Circuit · ZZFeatureMap, 2 repetitions
                  </p>
                  <CircuitDiagram ops={r.quantum.circuit} nQubits={r.quantum.n_qubits} />
                  <p className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 8 }}>
                    ANGLES {r.quantum.angles.map((a) => a.toFixed(2)).join(' · ')}
                  </p>
                </div>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>
                    Measurement distribution
                  </p>
                  <div style={{ display: 'grid', gap: 5 }}>
                    {r.quantum.amplitudes.map((a) => (
                      <div key={a.state} style={{ display: 'grid',
                                                  gridTemplateColumns: '56px 1fr 56px',
                                                  gap: 10, alignItems: 'center' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
                          |{a.state}⟩
                        </span>
                        <div style={{ height: 6, background: 'rgba(255,255,255,.07)',
                                      borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, a.probability * 100 * 4)}%`, height: '100%',
                            background: `hsl(${((a.phase + Math.PI) / (2 * Math.PI)) * 260 + 200}, 80%, 62%)`,
                          }} />
                        </div>
                        <span className="mono" style={{ fontSize: 10, textAlign: 'right',
                                                        color: 'var(--ink-faint)' }}>
                          {(a.probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 10 }}>
                    BAR COLOUR ENCODES THE RELATIVE PHASE
                  </p>
                </div>
              </div>
            </div>

            {/* ---------- kernel space ---------- */}
            <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 4 }}>
                  Where it lands in encoded space
                </p>
                <KernelSpace points={kernelPts} query={r.quantum.angles} />
                <p style={{ fontSize: 12.2, color: 'var(--ink-dim)', marginBottom: 0 }}>
                  Held-out variants plotted on the first three encoding angles —
                  rose for pathogenic, green for benign. The white marker is the
                  variant you entered. Drag to rotate.
                </p>
              </div>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>
                  Nearest training variants by quantum kernel fidelity
                </p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {r.quantum.neighbours.map((n, i) => (
                    <div key={i} style={{ display: 'grid',
                                          gridTemplateColumns: '1fr 84px 52px',
                                          gap: 10, alignItems: 'center' }}>
                      <div style={{ height: 6, background: 'rgba(255,255,255,.07)',
                                    borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${n.fidelity * 100}%`, height: '100%',
                                      background: n.label === 'Pathogenic'
                                        ? 'var(--rose)' : 'var(--emerald)' }} />
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>{n.label}</span>
                      <span className="mono" style={{ fontSize: 10.5, textAlign: 'right',
                                                      color: 'var(--ink-faint)' }}>
                        {n.fidelity.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12.2, color: 'var(--ink-dim)', marginBottom: 0, marginTop: 14 }}>
                  Fidelity |⟨φ(x)|φ(x′)⟩|² between this variant's state and its closest
                  neighbours in the QSVM training set. This is the similarity the
                  quantum model actually reasons over.
                </p>
              </div>
            </div>

            <BatchPanel />

            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '26px 0 0',
                        maxWidth: '80ch' }}>
              Research output only. QGene is not a diagnostic device and its
              predictions carry no clinical standing.
            </p>
          </>
        )}
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
