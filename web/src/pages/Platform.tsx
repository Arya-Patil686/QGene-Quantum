import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PipelineFlow from '../components/PipelineFlow';
import { GroupedBars, INK_FAINT, Legend, LineChart, SERIES } from '../components/charts';
import {
  DOMAIN_COLOUR, platform, type DatasetRecord, type PlatformOverview,
} from '../lib/api';
import { useReveal } from '../lib/motion';

const MODEL_ORDER = [
  ['logistic_regression', 'Logistic regression'],
  ['random_forest', 'Random forest'],
  ['svm', 'SVM (RBF)'],
  ['qsvm', 'QSVM'],
  ['vqc', 'VQC'],
  ['qnn', 'QNN'],
  ['hybrid', 'Hybrid'],
] as const;

export default function Platform() {
  const scope = useRef<HTMLDivElement>(null);
  const [ov, setOv] = useState<PlatformOverview | null>(null);
  const [active, setActive] = useState<string>('breast_wdbc');
  const [rec, setRec] = useState<DatasetRecord | null>(null);

  useEffect(() => { platform.overview().then(setOv).catch(() => {}); }, []);
  useEffect(() => {
    setRec(null);
    platform.dataset(active).then(setRec).catch(() => {});
  }, [active]);
  useReveal(scope, [ov, rec]);

  const comparison = ov?.comparison ?? [];

  const gapGroups = useMemo(
    () => comparison.map((c) => ({
      label: c.dataset.split('_')[0],
      values: [c.classical, c.quantum, c.hybrid],
    })),
    [comparison]);

  const kd = rec?.kernel_diagnostics;

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">The platform</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '17ch' }}>
          One pipeline, five diseases.
        </h1>
        <p className="lede" style={{ marginTop: 20 }}>
          The same hybrid quantum–classical stack — cleaning, imputation, feature
          selection, PCA, quantum encoding, six models and a calibrated ensemble —
          applied unchanged across cancer, cardiovascular, neurological and
          metabolic datasets. Nothing in the pipeline knows which disease it is
          looking at.
        </p>

        {/* ---------- catalogue ---------- */}
        <div className="grid cols-3 reveal" style={{ marginTop: 34, gap: 18 }}>
          {(ov?.catalogue ?? []).map((d) => {
            const c = comparison.find((x) => x.dataset === d.id);
            const on = d.id === active;
            return (
              <button key={d.id} onClick={() => setActive(d.id)}
                      className="panel"
                      style={{ textAlign: 'left', cursor: 'pointer',
                               borderColor: on ? 'rgba(124,92,255,.55)' : 'var(--line)',
                               background: on ? 'rgba(124,92,255,.09)' : 'var(--panel)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', gap: 8 }}>
                  <span className="chip" style={{
                    borderColor: `${DOMAIN_COLOUR[d.domain]}66`,
                    color: DOMAIN_COLOUR[d.domain],
                    background: `${DOMAIN_COLOUR[d.domain]}18` }}>
                    {d.domain}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                    {d.n_qubits}Q
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 22,
                             margin: '13px 0 6px', lineHeight: 1.15 }}>{d.disease}</h3>
                <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: 0,
                            minHeight: 34 }}>
                  {d.n_samples.toLocaleString()} samples · {d.n_features} features ·{' '}
                  {d.modality}
                </p>
                {c && (
                  <div className="mono" style={{ fontSize: 10.5, marginTop: 10,
                                                 color: 'var(--ink-faint)' }}>
                    HYBRID AUC {(c.hybrid * 100).toFixed(1)}%
                    {d.missing_rate > 0 &&
                      ` · ${(d.missing_rate * 100).toFixed(1)}% MISSING`}
                  </div>
                )}
              </button>
            );
          })}

          <Link to="/studio" className="panel reveal"
                style={{ borderStyle: 'dashed', display: 'flex',
                         flexDirection: 'column', justifyContent: 'center' }}>
            <span className="chip chip-benign">your data</span>
            <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 22,
                         margin: '13px 0 6px' }}>Bring your own dataset</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: 0 }}>
              Upload a CSV and the same pipeline trains on it in the browser →
            </p>
          </Link>
        </div>

        {/* ---------- cross-dataset comparison ---------- */}
        <div className="panel reveal" style={{ marginTop: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Where the quantum branch actually helps
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', maxWidth: '78ch' }}>
            Best classical model against best quantum model on each held-out test
            set. The quantum branch wins on two of the five, and the platform
            reports that rather than assuming it.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse',
                            minWidth: 700, marginTop: 8 }}>
              <thead>
                <tr>
                  {['Dataset', 'Domain', 'n', 'Best classical', 'Best quantum',
                    'Hybrid', 'Quantum share', ''].map((h) => (
                    <th key={h} className="mono" style={{
                      textAlign: ['Dataset', 'Domain'].includes(h) ? 'left' : 'right',
                      padding: '11px 10px', fontSize: 9.5, letterSpacing: '.1em',
                      textTransform: 'uppercase', color: 'var(--ink-faint)',
                      fontWeight: 400, borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => {
                  const wins = c.quantum > c.classical;
                  return (
                    <tr key={c.dataset} onClick={() => setActive(c.dataset)}
                        style={{ borderBottom: '1px solid var(--line-soft)',
                                 cursor: 'pointer',
                                 background: c.dataset === active
                                   ? 'rgba(124,92,255,.07)' : 'transparent' }}>
                      <td style={{ padding: '11px 10px', fontSize: 12.5 }}>{c.name}</td>
                      <td style={{ padding: '11px 10px', fontSize: 11.5,
                                   color: DOMAIN_COLOUR[c.domain] }}>{c.domain}</td>
                      <td className="mono" style={{ padding: '11px 10px', textAlign: 'right',
                                                    fontSize: 11.5, color: 'var(--ink-dim)' }}>
                        {c.n_samples.toLocaleString()}
                      </td>
                      <td className="mono" style={{ padding: '11px 10px', textAlign: 'right',
                                                    fontSize: 11.5 }}>
                        {(c.classical * 100).toFixed(2)}
                      </td>
                      <td className="mono" style={{ padding: '11px 10px', textAlign: 'right',
                                                    fontSize: 11.5,
                                                    color: wins ? SERIES[2] : 'var(--ink)' }}>
                        {(c.quantum * 100).toFixed(2)}
                      </td>
                      <td className="mono" style={{ padding: '11px 10px', textAlign: 'right',
                                                    fontSize: 11.5 }}>
                        {(c.hybrid * 100).toFixed(2)}
                      </td>
                      <td className="mono" style={{ padding: '11px 10px', textAlign: 'right',
                                                    fontSize: 11.5, color: 'var(--ink-faint)' }}>
                        {(c.quantum_weight * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '11px 10px', textAlign: 'right' }}>
                        {wins
                          ? <span className="chip chip-quantum">quantum ahead</span>
                          : <span className="chip">classical ahead</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {comparison.length > 0 && (
            <>
              <GroupedBars groups={gapGroups}
                           models={['Best classical', 'Best quantum', 'Hybrid']}
                           height={220} />
              <Legend items={[
                { name: 'Best classical', colour: SERIES[0] },
                { name: 'Best quantum', colour: SERIES[1] },
                { name: 'Hybrid', colour: SERIES[2] },
              ]} />
              <p className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)',
                                           marginTop: 8 }}>
                ROC-AUC ON THE HELD-OUT TEST SET OF EACH DATASET
              </p>
            </>
          )}
        </div>

        {/* ---------- selected dataset ---------- */}
        {rec && (
          <>
            <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  Pre-processing · {rec.dataset.name}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginBottom: 18 }}>
                  {rec.dataset.description}
                </p>
                <PipelineFlow stages={rec.stages} />
              </div>

              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 16 }}>
                  Every model on this dataset
                </p>
                <GroupedBars
                  groups={[
                    { label: 'Accuracy', values: MODEL_ORDER.map(([k]) => rec.models[k].accuracy) },
                    { label: 'Sensitivity', values: MODEL_ORDER.map(([k]) => rec.models[k].sensitivity) },
                    { label: 'Specificity', values: MODEL_ORDER.map(([k]) => rec.models[k].specificity) },
                    { label: 'ROC-AUC', values: MODEL_ORDER.map(([k]) => rec.models[k].roc_auc) },
                  ]}
                  models={MODEL_ORDER.map(([, n]) => n)}
                  height={250} />
                <Legend items={MODEL_ORDER.map(([, n], i) => ({
                  name: n, colour: SERIES[i % SERIES.length] }))} />

                <div className="rule" style={{ margin: '18px 0 14px' }} />
                <p className="eyebrow" style={{ marginBottom: 10 }}>
                  Ensemble weights fitted on validation
                </p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {Object.entries({ ...rec.model_weights.classical,
                                    ...rec.model_weights.quantum }).map(([k, v]) => (
                    <div key={k} style={{ display: 'grid',
                                          gridTemplateColumns: '132px 1fr 44px',
                                          gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>
                        {MODEL_ORDER.find(([m]) => m === k)?.[1] ?? k}
                      </span>
                      <div style={{ height: 5, background: 'rgba(255,255,255,.07)',
                                    borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${v * 100}%`, height: '100%',
                                      background: (k in rec.model_weights.quantum)
                                        ? SERIES[2] : SERIES[0] }} />
                      </div>
                      <span className="mono" style={{ fontSize: 10.5, textAlign: 'right',
                                                      color: INK_FAINT }}>
                        {(v * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ---------- kernel diagnostic ---------- */}
            {kd && (
              <div className="panel reveal" style={{ marginTop: 22 }}>
                <span className={`chip ${kd.concentrating ? 'chip-warn' : 'chip-benign'}`}>
                  quantum advantage diagnostic
                </span>
                <div className="grid cols-2" style={{ gap: 34, marginTop: 18,
                                                      alignItems: 'start' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 400,
                                 fontSize: 30, margin: '0 0 12px', lineHeight: 1.15 }}>
                      Will a quantum kernel help here?
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>
                      Two numbers answer that before a single model is trained.
                      <strong style={{ color: 'var(--ink)' }}> Alignment</strong> is
                      how far the kernel's similarity structure already agrees with
                      the labels. <strong style={{ color: 'var(--ink)' }}>Off-diagonal
                      spread</strong> is how much the fidelities vary at all — as
                      qubits are added it collapses towards zero, leaving a kernel
                      matrix that is effectively the identity and separates nothing.
                    </p>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>{kd.verdict}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 0 }}>
                      The sweep is only cheap because the kernel is evaluated in
                      closed form — each width costs one batch of state
                      preparations instead of n² circuit simulations.
                    </p>
                  </div>
                  <div>
                    <LineChart
                      series={[
                        { name: 'Spread', colour: SERIES[3],
                          points: kd.sweep.map((r) => ({ x: r.qubits, y: r.off_diagonal_std })) },
                        { name: 'Alignment', colour: SERIES[2],
                          points: kd.sweep.map((r) => ({ x: r.qubits, y: r.alignment })) },
                      ]}
                      xLabel="qubits" yLabel="value" height={210}
                      xFormat={(v) => v.toFixed(0)}
                      yFormat={(v) => v.toFixed(2)} />
                    <table style={{ width: '100%', borderCollapse: 'collapse',
                                    fontSize: 11.5, marginTop: 8 }}>
                      <thead>
                        <tr>{['q', 'alignment', 'off-diag std', 'variance'].map((h) => (
                          <th key={h} className="mono" style={{
                            textAlign: h === 'q' ? 'left' : 'right', padding: '6px 6px',
                            fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                            color: 'var(--ink-faint)', fontWeight: 400,
                            borderBottom: '1px solid var(--line)' }}>{h}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {kd.sweep.map((r) => (
                          <tr key={r.qubits}>
                            <td className="mono" style={{ padding: '5px 6px' }}>{r.qubits}</td>
                            <td className="mono" style={{ padding: '5px 6px', textAlign: 'right',
                                                          color: 'var(--ink-dim)' }}>
                              {r.alignment.toFixed(4)}
                            </td>
                            <td className="mono" style={{ padding: '5px 6px', textAlign: 'right',
                                                          color: r.off_diagonal_std < 0.02
                                                            ? 'var(--amber)' : 'var(--ink-dim)' }}>
                              {r.off_diagonal_std.toFixed(5)}
                            </td>
                            <td className="mono" style={{ padding: '5px 6px', textAlign: 'right',
                                                          color: 'var(--ink-faint)' }}>
                              {(r.variance_retained * 100).toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to={`/detect?dataset=${active}`}>
                Run a detection on this dataset
              </Link>
              {active === 'brca_clinvar' && (
                <Link className="btn" to="/genomics">Open the genomics deep-dive</Link>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
