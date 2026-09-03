import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BlochSpheres from '../components/BlochSpheres';
import ProbabilityDial from '../components/ProbabilityDial';
import ShapChart from '../components/ShapChart';
import ThresholdTuner from '../components/ThresholdTuner';
import { SERIES } from '../components/charts';
import {
  DOMAIN_COLOUR, platform, type DatasetRecord, type DatasetSummary,
  type DetectResult, type FeatureSchema, type PlatformOverview,
} from '../lib/api';
import { useReveal } from '../lib/motion';

const TIER_COLOUR: Record<string, string> = {
  'Very low': '#199e70', Low: '#5aa06a', Moderate: '#c98500',
  High: '#e0666a', 'Very high': '#d5395f',
};

const MODEL_LABEL: Record<string, string> = {
  logistic_regression: 'Logistic regression', random_forest: 'Random forest',
  svm: 'SVM (RBF)', qsvm: 'QSVM', vqc: 'VQC', qnn: 'QNN',
  classical_mean: 'Classical ensemble', quantum_mean: 'Quantum ensemble',
  hybrid: 'Hybrid',
};

function ModelBar({ name, value, accent }: { name: string; value: number; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '138px 1fr 50px',
                  gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{name}</span>
      <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)',
                    overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: accent,
                      borderRadius: 4, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
      </div>
      <span className="mono" style={{ fontSize: 11, textAlign: 'right' }}>
        {(value * 100).toFixed(1)}
      </span>
    </div>
  );
}

export default function Detect() {
  const scope = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const [ov, setOv] = useState<PlatformOverview | null>(null);
  const [id, setId] = useState(params.get('dataset') ?? 'heart_cleveland');
  const [schema, setSchema] = useState<{ dataset: DatasetSummary; features: FeatureSchema[] } | null>(null);
  const [rec, setRec] = useState<DatasetRecord | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { platform.overview().then(setOv).catch(() => {}); }, []);

  useEffect(() => {
    setSchema(null); setResult(null); setError(null);
    platform.schema(id).then((s) => {
      setSchema(s);
      const v: Record<string, number> = {};
      s.features.forEach((f) => { v[f.name] = f.median; });
      setValues(v);
    }).catch((e) => setError(String(e)));
    platform.dataset(id).then(setRec).catch(() => {});
  }, [id]);

  useReveal(scope, [result, schema]);

  const run = async (v = values, t = threshold) => {
    setBusy(true); setError(null);
    try {
      setResult(await platform.detect(id, v, t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (schema && Object.keys(values).length) run(values, threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const randomise = () => {
    if (!schema) return;
    const v: Record<string, number> = {};
    schema.features.forEach((f) => {
      v[f.name] = Number((f.min + Math.random() * (f.max - f.min)).toFixed(3));
    });
    setValues(v); run(v, threshold);
  };

  const tiers = rec?.risk_tiers ?? [];
  const activeTier = result?.risk.tier;
  const domain = schema?.dataset.domain ?? 'cancer';

  const positiveAtThreshold = useMemo(() => {
    if (!result) return null;
    return result.probability >= threshold;
  }, [result, threshold]);

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">Detection and decision support</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '18ch' }}>
          A probability, a risk tier, and a threshold you control.
        </h1>

        {/* dataset picker */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28 }}>
          {(ov?.catalogue ?? []).map((d) => (
            <button key={d.id} className="chip"
                    onClick={() => { setId(d.id); setParams({ dataset: d.id }); }}
                    style={{ cursor: 'pointer',
                             borderColor: d.id === id ? `${DOMAIN_COLOUR[d.domain]}88` : 'var(--line)',
                             color: d.id === id ? DOMAIN_COLOUR[d.domain] : 'var(--ink-dim)',
                             background: d.id === id ? `${DOMAIN_COLOUR[d.domain]}18` : 'transparent' }}>
              {d.disease}
            </button>
          ))}
        </div>

        {error && <p style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</p>}

        <div className="grid cols-2" style={{ marginTop: 22, gap: 22, alignItems: 'start' }}>
          {/* ---------- inputs ---------- */}
          <div className="panel reveal">
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <p className="eyebrow" style={{ margin: 0 }}>
                {schema?.dataset.disease ?? 'Loading'} · patient measurements
              </p>
              <button className="btn" style={{ padding: '6px 13px', fontSize: 11.5 }}
                      onClick={randomise}>Randomise</button>
            </div>
            <p style={{ fontSize: 12.3, color: 'var(--ink-dim)', marginTop: 8 }}>
              Values start at the dataset median. Every field is optional — anything
              left alone is imputed exactly as it is during training.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 14,
                          maxHeight: 430, overflowY: 'auto', paddingRight: 6 }}>
              {(schema?.features ?? []).map((f) => (
                <div key={f.name} style={{ display: 'grid',
                                           gridTemplateColumns: '1fr 96px',
                                           gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                      {f.name.replace(/_/g, ' ')}
                    </div>
                    <input type="range" min={f.min} max={f.max}
                           step={(f.max - f.min) / 200 || 0.01}
                           value={values[f.name] ?? f.median}
                           onChange={(e) => setValues({ ...values, [f.name]: Number(e.target.value) })}
                           onMouseUp={() => run()}
                           onTouchEnd={() => run()}
                           style={{ width: '100%', padding: 0, border: 0,
                                    background: 'transparent',
                                    accentColor: DOMAIN_COLOUR[domain] }} />
                  </div>
                  <input className="mono" value={values[f.name] ?? ''}
                         onChange={(e) => setValues({ ...values, [f.name]: Number(e.target.value) })}
                         onBlur={() => run()}
                         style={{ fontSize: 11.5, padding: '7px 9px' }} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }}
                    onClick={() => run()} disabled={busy}>
              {busy ? 'Scoring…' : 'Run detection'}
            </button>
          </div>

          {/* ---------- verdict ---------- */}
          <div style={{ display: 'grid', gap: 22 }}>
            {result && (
              <div className="panel reveal" style={{ textAlign: 'center' }}>
                <ProbabilityDial p={result.probability}
                                 label={`probability of ${result.disease.toLowerCase()}`} />
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center',
                              gap: 8, flexWrap: 'wrap' }}>
                  <span className={`chip ${positiveAtThreshold ? 'chip-path' : 'chip-benign'}`}>
                    {positiveAtThreshold
                      ? schema?.dataset.positive_label
                      : schema?.dataset.negative_label}
                  </span>
                  <span className="chip" style={{
                    borderColor: `${TIER_COLOUR[result.risk.tier]}77`,
                    color: TIER_COLOUR[result.risk.tier],
                    background: `${TIER_COLOUR[result.risk.tier]}1a` }}>
                    {result.risk.tier} risk
                  </span>
                  <span className={`chip ${result.conformal.status === 'committed'
                    ? 'chip-benign' : 'chip-warn'}`}>
                    {result.conformal.status === 'committed'
                      ? `committed · ${result.conformal.confidence_level}%`
                      : 'model abstains'}
                  </span>
                </div>

                {/* risk ladder */}
                <div style={{ display: 'flex', gap: 3, marginTop: 20 }}>
                  {tiers.map((t) => (
                    <div key={t.tier} style={{ flex: 1, textAlign: 'center' }}
                         title={`${t.tier}: ${t.n} test cases, ${
                           t.observed_positive_rate === null ? 'n/a'
                           : `${(t.observed_positive_rate * 100).toFixed(0)}% actually positive`}`}>
                      <div style={{
                        height: 7, borderRadius: 3,
                        background: TIER_COLOUR[t.tier],
                        opacity: t.tier === activeTier ? 1 : 0.28,
                        outline: t.tier === activeTier ? '2px solid rgba(255,255,255,.5)' : 'none',
                        outlineOffset: 2,
                      }} />
                      <div className="mono" style={{ fontSize: 8.5, marginTop: 7,
                                                     color: t.tier === activeTier
                                                       ? 'var(--ink)' : 'var(--ink-faint)' }}>
                        {t.observed_positive_rate === null ? '—'
                          : `${(t.observed_positive_rate * 100).toFixed(0)}%`}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)',
                                             marginTop: 8, marginBottom: 0 }}>
                  OBSERVED POSITIVE RATE PER RISK BAND ON THE HELD-OUT TEST SET
                </p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)',
                                             marginTop: 10, marginBottom: 0 }}>
                  {result.latency_ms} MS · {result.weights.classical * 100}C /{' '}
                  {result.weights.quantum * 100}Q
                </p>
              </div>
            )}

            {result && (
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>
                  How each model voted
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {['logistic_regression', 'random_forest', 'svm'].map((k) => (
                    <ModelBar key={k} name={MODEL_LABEL[k]} value={result.models[k]}
                              accent={SERIES[0]} />
                  ))}
                  <div className="rule" style={{ margin: '3px 0' }} />
                  {['qsvm', 'vqc', 'qnn'].map((k) => (
                    <ModelBar key={k} name={MODEL_LABEL[k]} value={result.models[k]}
                              accent={SERIES[2]} />
                  ))}
                  <div className="rule" style={{ margin: '3px 0' }} />
                  <ModelBar name="Hybrid" value={result.models.hybrid} accent={SERIES[4]} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- threshold tuning ---------- */}
        {rec && (
          <div className="panel reveal" style={{ marginTop: 22 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              Threshold tuning · sensitivity against specificity
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', maxWidth: '80ch' }}>
              Early detection and confirmation are different jobs. A screening pass
              wants to miss nobody and tolerates false alarms; a confirmatory test
              wants the opposite. The operating point is a clinical decision, so it
              is exposed here rather than fixed at 0.5.
            </p>
            <ThresholdTuner rows={rec.thresholds}
                            positiveLabel={rec.dataset.positive_label}
                            onChange={(t) => { setThreshold(t); }} />
          </div>
        )}

        {/* ---------- explanation + quantum ---------- */}
        {result && (
          <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
            {result.explanation && (
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>
                  Why — SHAP contributions
                </p>
                <ShapChart rows={result.explanation.map((e) => ({
                  ...e, feature: e.feature.replace(/_/g, ' ') }))} />
              </div>
            )}
            <div className="panel reveal">
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <p className="eyebrow" style={{ margin: 0 }}>
                  The quantum state this patient produces
                </p>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                  {result.quantum_state.n_qubits} QUBITS
                </span>
              </div>
              <BlochSpheres vectors={result.quantum_state.bloch} />
              <p style={{ fontSize: 12.3, color: 'var(--ink-dim)', marginTop: 4 }}>
                Nearest training cases by quantum kernel fidelity, scaled to the
                closest match — absolute values are small here because the kernel
                has concentrated at this register width.
              </p>
              <div style={{ display: 'grid', gap: 5 }}>
                {(() => {
                  const near = result.quantum_state.neighbours.slice(0, 6);
                  const top = Math.max(...near.map((n) => n.fidelity), 1e-6);
                  return near.map((n, i) => (
                    <div key={i} style={{ display: 'grid',
                                          gridTemplateColumns: '1fr 120px 46px',
                                          gap: 10, alignItems: 'center' }}>
                      <div style={{ height: 5, background: 'rgba(255,255,255,.07)',
                                    borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(n.fidelity / top) * 100}%`,
                                      height: '100%',
                                      background: n.label === schema?.dataset.positive_label
                                        ? 'var(--rose)' : 'var(--emerald)' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{n.label}</span>
                      <span className="mono" style={{ fontSize: 10, textAlign: 'right',
                                                      color: 'var(--ink-faint)' }}>
                        {n.fidelity.toFixed(3)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '26px 0 0',
                    maxWidth: '80ch' }}>
          Research output only. This platform is not a diagnostic device and its
          predictions carry no clinical standing.
        </p>
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
