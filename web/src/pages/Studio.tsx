import { useRef, useState } from 'react';
import PipelineFlow from '../components/PipelineFlow';
import { Confusion, GroupedBars, Legend, LineChart, SERIES } from '../components/charts';
import ThresholdTuner from '../components/ThresholdTuner';
import { platform, type DatasetRecord, type UploadProfile } from '../lib/api';
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

const STEPS = ['Upload', 'Configure', 'Train', 'Results'];

export default function Studio() {
  const scope = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UploadProfile | null>(null);
  const [target, setTarget] = useState<string>('');
  const [nQubits, setNQubits] = useState(6);
  const [name, setName] = useState('Uploaded dataset');
  const [result, setResult] = useState<DatasetRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useReveal(scope, [profile, result]);

  const step = result ? 3 : busy === 'train' ? 2 : profile ? 1 : 0;

  const upload = async (f: File) => {
    setBusy('upload'); setError(null); setResult(null);
    try {
      const p = await platform.profile(f);
      setProfile(p);
      setTarget(p.suggested_target ?? '');
      setName(f.name.replace(/\.csv$/i, ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally { setBusy(null); }
  };

  const train = async () => {
    if (!target) return;
    setBusy('train'); setError(null);
    try {
      setResult(await platform.train(target, name, nQubits));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training failed');
    } finally { setBusy(null); }
  };

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">Studio</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '18ch' }}>
          Bring your own dataset.
        </h1>
        <p className="lede" style={{ marginTop: 20 }}>
          Upload any binary-outcome biomedical table. The platform profiles it,
          runs the same cleaning, imputation, feature selection, PCA and quantum
          encoding, then trains all six models and benchmarks them against each
          other — in the browser, in about ten seconds.
        </p>

        {/* stepper */}
        <div style={{ display: 'flex', gap: 0, marginTop: 30, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 99, display: 'grid',
                  placeItems: 'center', fontSize: 11, fontFamily: 'var(--mono)',
                  border: `1px solid ${i <= step ? 'transparent' : 'var(--line)'}`,
                  background: i <= step
                    ? 'linear-gradient(140deg, var(--violet), var(--cyan))'
                    : 'transparent',
                  color: i <= step ? '#fff' : 'var(--ink-faint)',
                }}>{i + 1}</div>
                <span style={{ fontSize: 12.5,
                               color: i <= step ? 'var(--ink)' : 'var(--ink-faint)' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 44, height: 1, background: 'var(--line)',
                              margin: '0 14px' }} />
              )}
            </div>
          ))}
        </div>

        {/* ---------- upload ---------- */}
        <div className="panel reveal" style={{ marginTop: 22 }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) upload(f);
            }}
            style={{
              border: '1px dashed var(--line)', borderRadius: 14,
              padding: '34px 24px', textAlign: 'center',
              background: 'rgba(255,255,255,0.015)',
            }}>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 22, margin: '0 0 8px' }}>
              Drop a CSV here
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '0 0 16px' }}>
              One row per patient, one column the binary outcome. Up to 8 MB.
            </p>
            <button className="btn btn-primary" disabled={busy === 'upload'}
                    onClick={() => fileRef.current?.click()}>
              {busy === 'upload' ? 'Reading…' : 'Choose a file'}
            </button>
          </div>

          {error && <p style={{ color: 'var(--rose)', fontSize: 13, marginBottom: 0 }}>{error}</p>}
        </div>

        {/* ---------- configure ---------- */}
        {profile && (
          <div className="panel reveal" style={{ marginTop: 22 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              {profile.rows.toLocaleString()} rows · {profile.columns.length} columns
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap',
                          alignItems: 'flex-end', marginTop: 12 }}>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor="target">Outcome column</label>
                <select id="target" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">choose…</option>
                  {profile.columns.filter((c) => c.binary).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} — {c.sample.slice(0, 2).join(' / ')}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label htmlFor="name">Dataset name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ flex: '0 1 150px' }}>
                <label htmlFor="q">Qubits</label>
                <select id="q" value={nQubits} onChange={(e) => setNQubits(Number(e.target.value))}>
                  {[4, 5, 6, 7, 8].map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={train}
                      disabled={!target || busy === 'train'}>
                {busy === 'train' ? 'Training the stack…' : 'Train'}
              </button>
            </div>

            {!profile.target_candidates.length && (
              <p style={{ color: 'var(--amber)', fontSize: 12.5, marginBottom: 0 }}>
                No column has exactly two distinct values. This platform trains
                binary detectors, so the outcome column needs two classes.
              </p>
            )}

            <div style={{ marginTop: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5,
                              minWidth: 640 }}>
                <thead>
                  <tr>
                    {['Column', 'Type', 'Missing', 'Distinct', 'Example values'].map((h) => (
                      <th key={h} className="mono" style={{
                        textAlign: h === 'Missing' || h === 'Distinct' ? 'right' : 'left',
                        padding: '9px 10px', fontSize: 9, letterSpacing: '.1em',
                        textTransform: 'uppercase', color: 'var(--ink-faint)',
                        fontWeight: 400, borderBottom: '1px solid var(--line)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.slice(0, 24).map((c) => (
                    <tr key={c.name} style={{ borderBottom: '1px solid var(--line-soft)',
                                              background: c.name === target
                                                ? 'rgba(124,92,255,.09)' : 'transparent' }}>
                      <td className="mono" style={{ padding: '8px 10px' }}>
                        {c.name}
                        {c.name === target && (
                          <span className="chip chip-quantum" style={{ marginLeft: 8 }}>target</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--ink-faint)' }}>
                        {c.numeric ? 'numeric' : 'categorical'}
                      </td>
                      <td className="mono" style={{ padding: '8px 10px', textAlign: 'right',
                                                    color: c.missing > 0 ? 'var(--amber)' : 'var(--ink-faint)' }}>
                        {(c.missing * 100).toFixed(1)}%
                      </td>
                      <td className="mono" style={{ padding: '8px 10px', textAlign: 'right',
                                                    color: 'var(--ink-faint)' }}>{c.unique}</td>
                      <td className="mono" style={{ padding: '8px 10px',
                                                    color: 'var(--ink-dim)' }}>
                        {c.sample.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {busy === 'train' && (
          <div className="panel" style={{ marginTop: 22, textAlign: 'center', padding: 40 }}>
            <p className="mono" style={{ fontSize: 11, letterSpacing: '.2em',
                                         textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
              cleaning · imputing · encoding · training six models
            </p>
            <div style={{ height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 3,
                          marginTop: 18, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '38%', borderRadius: 3,
                            background: 'linear-gradient(90deg, var(--violet), var(--cyan))',
                            animation: 'slide 1.4s ease-in-out infinite' }} />
            </div>
            <style>{`@keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(320%)} }`}</style>
          </div>
        )}

        {/* ---------- results ---------- */}
        {result && (
          <>
            <div className="grid cols-4 reveal" style={{ marginTop: 22, gap: 18 }}>
              {[
                { v: `${(result.models.hybrid.roc_auc * 100).toFixed(1)}%`, l: 'Hybrid ROC-AUC' },
                { v: `${(result.models.hybrid.sensitivity * 100).toFixed(1)}%`, l: 'Sensitivity' },
                { v: `${(result.models.hybrid.specificity * 100).toFixed(1)}%`, l: 'Specificity' },
                { v: `${result.fit_seconds ?? '—'}s`, l: 'Time to train the stack' },
              ].map((k) => (
                <div key={k.l} className="panel panel-tight">
                  <div className="mono" style={{ fontSize: 27, letterSpacing: '-.02em' }}>{k.v}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{k.l}</div>
                </div>
              ))}
            </div>

            <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 16 }}>
                  What the pipeline did to your data
                </p>
                <PipelineFlow stages={result.stages} />
              </div>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 16 }}>Model comparison</p>
                <GroupedBars
                  groups={[
                    { label: 'Accuracy', values: MODEL_ORDER.map(([k]) => result.models[k].accuracy) },
                    { label: 'Sensitivity', values: MODEL_ORDER.map(([k]) => result.models[k].sensitivity) },
                    { label: 'Specificity', values: MODEL_ORDER.map(([k]) => result.models[k].specificity) },
                    { label: 'ROC-AUC', values: MODEL_ORDER.map(([k]) => result.models[k].roc_auc) },
                  ]}
                  models={MODEL_ORDER.map(([, n]) => n)} height={250} />
                <Legend items={MODEL_ORDER.map(([, n], i) => ({
                  name: n, colour: SERIES[i % SERIES.length] }))} />
              </div>
            </div>

            <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 10 }}>ROC curves</p>
                <LineChart diagonal domain={{ x: [0, 1], y: [0, 1] }}
                  xLabel="false positive rate" yLabel="true positive rate" height={250}
                  series={MODEL_ORDER.filter(([k]) => result.roc[k]).map(([k, n], i) => ({
                    name: n, colour: SERIES[i % SERIES.length],
                    points: result.roc[k].fpr.map((f, j) => ({ x: f, y: result.roc[k].tpr[j] })),
                  }))} />
              </div>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  Quantum advantage diagnostic
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
                  {result.kernel_diagnostics?.verdict}
                </p>
                {result.kernel_diagnostics?.sweep?.length > 0 && (
                  <LineChart height={200} xLabel="qubits" yLabel="value"
                    xFormat={(v) => v.toFixed(0)} yFormat={(v) => v.toFixed(2)}
                    series={[
                      { name: 'Spread', colour: SERIES[3],
                        points: result.kernel_diagnostics.sweep.map((r) => ({
                          x: r.qubits, y: r.off_diagonal_std })) },
                      { name: 'Alignment', colour: SERIES[2],
                        points: result.kernel_diagnostics.sweep.map((r) => ({
                          x: r.qubits, y: r.alignment })) },
                    ]} />
                )}
              </div>
            </div>

            <div className="panel reveal" style={{ marginTop: 22 }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Tune the operating point
              </p>
              <ThresholdTuner rows={result.thresholds}
                              positiveLabel={result.dataset.positive_label} />
            </div>

            <div className="grid cols-3" style={{ marginTop: 22, gap: 22 }}>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>Confusion · hybrid</p>
                <Confusion c={result.models.hybrid.confusion} />
              </div>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>Calibrated abstention</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    ['Empirical coverage', `${(result.conformal.empirical_coverage * 100).toFixed(1)}%`],
                    ['Target', `${(result.conformal.target_coverage * 100).toFixed(0)}%`],
                    ['Abstains on', `${(result.conformal.abstention_rate * 100).toFixed(1)}%`],
                    ['Calibration set', `${result.conformal.n_calibration} rows`],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between',
                                          fontSize: 12, color: 'var(--ink-dim)' }}>
                      <span>{l}</span><span className="mono" style={{ color: 'var(--ink)' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {!result.conformal.guarantee_is_tight && (
                  <p style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 12,
                              marginBottom: 0 }}>
                    Fewer than 200 calibration rows — the coverage guarantee is
                    loose at this size and will wander around the target.
                  </p>
                )}
              </div>
              <div className="panel reveal">
                <p className="eyebrow" style={{ marginBottom: 14 }}>Top features</p>
                <div style={{ display: 'grid', gap: 5 }}>
                  {result.feature_importance.slice(0, 8).map((f) => (
                    <div key={f.feature} style={{ display: 'grid',
                                                  gridTemplateColumns: '1fr 44px',
                                                  gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-dim)',
                                     overflow: 'hidden', textOverflow: 'ellipsis',
                                     whiteSpace: 'nowrap' }}>
                        {f.feature.replace(/_/g, ' ')}
                      </span>
                      <span className="mono" style={{ fontSize: 10.5, textAlign: 'right',
                                                      color: 'var(--ink-faint)' }}>
                        {f.importance.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
