import { useEffect, useRef, useState } from 'react';
import {
  Confusion, GroupedBars, HBars, Legend, LineChart, SERIES,
} from '../components/charts';
import DecisionSurface from '../components/DecisionSurface';
import { useReveal } from '../lib/motion';
import { api } from '../lib/api';

const MODELS = [
  { key: 'random_forest', name: 'Random Forest' },
  { key: 'svm', name: 'SVM' },
  { key: 'qsvm', name: 'QSVM' },
  { key: 'vqc', name: 'VQC' },
  { key: 'hybrid', name: 'Hybrid' },
];

const PRETTY: Record<string, string> = {
  gene: 'Gene', var_type: 'Variant class', cdna_pos_rel: 'cDNA position',
  intron_offset_abs: 'Intron offset', is_intronic: 'Intronic',
  is_splice_site: 'Splice site', is_utr: 'UTR', aa_pos_rel: 'Protein position',
  log_var_len: 'Variant length', is_truncating: 'Truncating',
  is_frameshift: 'Frameshift', is_nonsense: 'Stop gained', is_missense: 'Missense',
  is_synonymous: 'Synonymous', is_inframe_indel: 'In-frame indel',
  in_critical_domain: 'In functional domain', domain_idx: 'Domain identity',
  grantham: 'Grantham distance', d_hydropathy: 'Hydropathy change',
  d_charge: 'Charge change', d_volume: 'Volume change', is_transition: 'Transition',
};

function Panel({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <div className="panel reveal">
      <p className="eyebrow" style={{ marginBottom: note ? 6 : 16 }}>{title}</p>
      {note && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '0 0 16px',
                    maxWidth: '72ch' }}>{note}</p>
      )}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const scope = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<any>(null);
  useEffect(() => { api.metrics().then(setM).catch(() => {}); }, []);
  useReveal(scope, [m]);

  if (!m) {
    return (
      <div style={{ paddingTop: 160, textAlign: 'center', color: 'var(--ink-faint)' }}
           className="mono">loading results…</div>
    );
  }

  const roc = MODELS.map((mo, i) => ({
    name: mo.name,
    colour: SERIES[i],
    points: (m.roc_curves?.[mo.key]?.fpr ?? []).map((f: number, j: number) => ({
      x: f, y: m.roc_curves[mo.key].tpr[j],
    })),
  })).filter((s) => s.points.length);

  const metricGroups = [
    { label: 'Accuracy', values: MODELS.map((mo) => m.models[mo.key].accuracy) },
    { label: 'F1', values: MODELS.map((mo) => m.models[mo.key].f1) },
    { label: 'ROC-AUC', values: MODELS.map((mo) => m.models[mo.key].roc_auc) },
    { label: 'PR-AUC', values: MODELS.map((mo) => m.models[mo.key].pr_auc) },
    { label: 'MCC', values: MODELS.map((mo) => m.models[mo.key].mcc) },
  ];

  const legend = MODELS.map((mo, i) => ({ name: mo.name, colour: SERIES[i] }));

  const risk = [{
    name: 'Selective error',
    colour: SERIES[3],
    points: (m.disagreement?.risk_coverage ?? []).map((p: any) => ({
      x: p.coverage, y: p.error,
    })),
  }];

  const loss = [{
    name: 'VQC loss',
    colour: SERIES[2],
    points: (m.vqc_loss_history ?? []).map((v: number, i: number) => ({ x: i, y: v })),
  }];

  const leak = m.leakage;

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">Held-out test set · variant-level split</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '16ch' }}>
          Results, with the caveats attached.
        </h1>
        <p className="lede" style={{ marginTop: 20 }}>
          Every figure below comes from {m.dataset.split.test.toLocaleString()} variants
          the models never saw, split so that no variant appears on both sides.
          Generated {m.generated}.
        </p>

        {/* headline numbers */}
        <div className="grid cols-4 reveal" style={{ marginTop: 34, gap: 22 }}>
          {[
            { v: (m.models.hybrid.roc_auc * 100).toFixed(1) + '%', l: 'Hybrid ROC-AUC' },
            { v: (m.models.hybrid.accuracy * 100).toFixed(1) + '%', l: 'Hybrid accuracy' },
            { v: (m.conformal.empirical_coverage * 100).toFixed(1) + '%',
              l: `Conformal coverage (target ${(m.conformal.target_coverage * 100).toFixed(0)}%)` },
            { v: (m.conformal.accuracy_on_confident_calls * 100).toFixed(1) + '%',
              l: 'Accuracy when the model commits' },
          ].map((k) => (
            <div key={k.l} className="panel panel-tight">
              <div className="mono" style={{ fontSize: 30, letterSpacing: '-0.03em' }}>{k.v}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{k.l}</div>
            </div>
          ))}
        </div>

        <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
          <Panel title="ROC curves"
                 note="Quantum models are trained on the same features through a 4-dimensional PCA bottleneck, which costs them information the classical models keep.">
            <LineChart series={roc} diagonal domain={{ x: [0, 1], y: [0, 1] }}
                       xLabel="false positive rate" yLabel="true positive rate" height={280} />
            <Legend items={legend} />
          </Panel>

          <Panel title="Metrics across models">
            <GroupedBars groups={metricGroups} models={MODELS.map((x) => x.name)} height={280} />
            <Legend items={legend} />
          </Panel>
        </div>

        {/* leakage */}
        <div className="panel reveal" style={{ marginTop: 22 }}>
          <span className="chip chip-warn">Methodological correction</span>
          <div className="grid cols-2" style={{ gap: 40, marginTop: 18, alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 32,
                           margin: '0 0 14px' }}>
                What the duplicate rows were worth
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>
                ClinVar publishes each variant once per genome assembly, so a
                naive row-level split places {leak.variants_shared_between_train_and_test.toLocaleString()} of
                the {leak.test_rows.toLocaleString()} test rows' variants in the training
                set as well. Same features, same model, same data — the only
                difference is whether the split respects variant identity.
              </p>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 0 }}>
                The gap is <strong style={{ color: 'var(--amber)' }}>
                {leak.inflation_points.toFixed(1)} accuracy points</strong> of pure
                memorisation. Every other number on this site is measured the honest way.
              </p>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[
                { l: 'Row-level split (inflated)', v: leak.row_level_split_accuracy, c: '#c98500' },
                { l: 'Variant-level split (honest)', v: leak.variant_level_split_accuracy, c: SERIES[1] },
              ].map((b) => (
                <div key={b.l}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                fontSize: 12.5, color: 'var(--ink-dim)', marginBottom: 7 }}>
                    <span>{b.l}</span>
                    <span className="mono">{(b.v * 100).toFixed(2)}%</span>
                  </div>
                  <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,.06)',
                                overflow: 'hidden' }}>
                    <div style={{ width: `${b.v * 100}%`, height: '100%', background: b.c,
                                  borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
          <Panel title="Selective prediction"
                 note="Ranking test variants by quantum–classical disagreement and confidence, then answering only the easiest fraction. Error falls as coverage falls, which is what a usable abstention signal looks like.">
            <LineChart series={risk} xLabel="coverage" yLabel="error rate"
                       domain={{ x: [0, 1], y: [0, Math.max(0.2, ...risk[0].points.map((pt: { y: number }) => pt.y))] }}
                       height={250} />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12,
                             marginTop: 14 }}>
              <tbody>
                {[
                  ['Confidence margin alone', m.disagreement.auc_margin_detects_error],
                  ['Quantum–classical disagreement alone', m.disagreement.auc_disagreement_detects_error],
                  ['Both combined', m.disagreement.auc_combined],
                ].map(([l, v]) => (
                  <tr key={l as string} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '8px 4px', color: 'var(--ink-dim)' }}>{l}</td>
                    <td className="mono" style={{ padding: '8px 4px', textAlign: 'right' }}>
                      {(v as number).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12.2, color: 'var(--ink-dim)', marginTop: 12, marginBottom: 0 }}>
              Reported as measured: disagreement is the <em>weaker</em> signal here.
              The confidence margin detects errors far better, so disagreement is
              surfaced as a secondary flag for human review rather than sold as the
              uncertainty measure.
            </p>
          </Panel>

          <Panel title="Conformal prediction"
                 note="A distribution-free guarantee: calibrated on the validation split, the true label lands inside the returned set at the target rate. Where it cannot, it returns both labels instead of guessing.">
            <div className="grid cols-2" style={{ gap: 14 }}>
              {[
                { l: 'Target coverage', v: `${(m.conformal.target_coverage * 100).toFixed(0)}%` },
                { l: 'Empirical coverage', v: `${(m.conformal.empirical_coverage * 100).toFixed(1)}%` },
                { l: 'Coverage · benign', v: `${(m.conformal.coverage_benign * 100).toFixed(1)}%` },
                { l: 'Coverage · pathogenic', v: `${(m.conformal.coverage_pathogenic * 100).toFixed(1)}%` },
                { l: 'Commits to a call', v: `${(m.conformal.singleton_rate * 100).toFixed(1)}%` },
                { l: 'Abstains', v: `${(m.conformal.abstention_rate * 100).toFixed(1)}%` },
              ].map((k) => (
                <div key={k.l} style={{ padding: '12px 14px', borderRadius: 10,
                                        border: '1px solid var(--line-soft)' }}>
                  <div className="mono" style={{ fontSize: 20 }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 4 }}>{k.l}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
          <Panel title="What the model leans on"
                 note="Random Forest impurity importance over the molecular feature set.">
            <HBars rows={(m.feature_importance ?? []).slice(0, 14).map((f: any) => ({
              label: PRETTY[f.feature] ?? f.feature, value: f.importance,
            }))} />
          </Panel>

          <Panel title="VQC training"
                 note={`Cross-entropy during COBYLA optimisation. Batched statevector simulation makes it practical to fit all ${m.quantum.vqc_train_samples.toLocaleString()} training variants rather than a small subset.`}>
            <LineChart series={loss} xLabel="objective evaluation (every 4th)"
                       yLabel="loss" height={230} />
          </Panel>
        </div>

        <div className="grid cols-3" style={{ marginTop: 22, gap: 22 }}>
          <Panel title="Confusion · hybrid"><Confusion c={m.models.hybrid.confusion} /></Panel>
          <Panel title="Confusion · QSVM"><Confusion c={m.models.qsvm.confusion} /></Panel>
          <Panel title="Confusion · Random Forest"><Confusion c={m.models.random_forest.confusion} /></Panel>
        </div>

        <div className="grid cols-2" style={{ marginTop: 22, gap: 22 }}>
          <Panel title="Statistical comparison · McNemar"
                 note="Exact McNemar test on paired predictions over the test set. n01 and n10 count the variants where exactly one of the two models is right.">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Comparison', 'n01', 'n10', 'p', ''].map((h) => (
                  <th key={h} className="mono" style={{ textAlign: h === 'Comparison' ? 'left' : 'right',
                        padding: '8px 6px', fontSize: 9.5, letterSpacing: '.1em',
                        textTransform: 'uppercase', color: 'var(--ink-faint)',
                        fontWeight: 400, borderBottom: '1px solid var(--line)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {Object.entries(m.mcnemar).map(([k, v]: [string, any]) => (
                  <tr key={k} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '9px 6px', color: 'var(--ink-dim)' }}>
                      {k.replace(/_/g, ' ').replace(' vs ', ' vs ')}
                    </td>
                    <td className="mono" style={{ padding: '9px 6px', textAlign: 'right' }}>{v.n01}</td>
                    <td className="mono" style={{ padding: '9px 6px', textAlign: 'right' }}>{v.n10}</td>
                    <td className="mono" style={{ padding: '9px 6px', textAlign: 'right' }}>
                      {v.p_value < 0.001 ? '<0.001' : v.p_value.toFixed(3)}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right' }}>
                      <span className={`chip ${v.significant ? 'chip-warn' : 'chip-benign'}`}>
                        {v.significant ? 'differs' : 'equivalent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Quantum implementation">
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr',
                         gap: '11px 20px' }}>
              {([
                ['Qubits', m.quantum.n_qubits],
                ['Feature map', m.quantum.feature_map],
                ['Ansatz', m.quantum.ansatz],
                ['PCA variance retained', `${(m.quantum.pca_variance_retained * 100).toFixed(1)}%`],
                ['QSVM training samples', m.quantum.qsvm_train_samples.toLocaleString()],
                ['VQC training samples', m.quantum.vqc_train_samples.toLocaleString()],
                ['Gram matrix build', `${m.quantum.gram_matrix_seconds}s`],
                ['Deviation vs Qiskit', Number(m.quantum.kernel_max_deviation_vs_qiskit).toExponential(1)],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt className="mono" style={{ fontSize: 10, letterSpacing: '.08em',
                        textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{k}</dt>
                  <dd className="mono" style={{ margin: 0, fontSize: 12 }}>{v}</dd>
                </div>
              ))}
            </dl>
            <p style={{ fontSize: 12.4, color: 'var(--ink-dim)', marginTop: 18, marginBottom: 0 }}>
              The kernel is computed in closed form from prepared statevectors and
              agrees with Qiskit's own fidelity kernel to machine precision, so the
              speed-up costs no fidelity.
            </p>
          </Panel>
        </div>

        {m.by_consequence && (
          <Panel title="Where the accuracy actually comes from"
                 note="The headline number is a property of the labelled subset, not evidence of a strong model. Almost every ClinVar BRCA record labelled pathogenic is truncating, and almost every record labelled benign is synonymous or deep intronic — so most of the test set separates on consequence alone.">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {['Consequence', 'n', 'Pathogenic share', 'Accuracy', ''].map((h) => (
                    <th key={h} className="mono" style={{
                      textAlign: h === 'Consequence' ? 'left' : 'right',
                      padding: '9px 8px', fontSize: 9.5, letterSpacing: '.1em',
                      textTransform: 'uppercase', color: 'var(--ink-faint)',
                      fontWeight: 400, borderBottom: '1px solid var(--line)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.by_consequence.map((r: any) => {
                  const hard = r.consequence === 'missense';
                  return (
                    <tr key={r.consequence} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '10px 8px',
                                   color: hard ? 'var(--amber)' : 'var(--ink)' }}>
                        {r.consequence}
                      </td>
                      <td className="mono" style={{ padding: '10px 8px', textAlign: 'right',
                                                    color: 'var(--ink-dim)' }}>
                        {r.n.toLocaleString()}
                      </td>
                      <td className="mono" style={{ padding: '10px 8px', textAlign: 'right',
                                                    color: 'var(--ink-dim)' }}>
                        {(r.share_pathogenic * 100).toFixed(0)}%
                      </td>
                      <td className="mono" style={{ padding: '10px 8px', textAlign: 'right',
                                                    color: hard ? 'var(--amber)' : 'var(--ink)' }}>
                        {(r.accuracy * 100).toFixed(2)}%
                      </td>
                      <td style={{ padding: '10px 8px', width: 130 }}>
                        <div style={{ height: 5, background: 'rgba(255,255,255,.07)',
                                      borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${r.accuracy * 100}%`, height: '100%',
                                        background: hard ? 'var(--amber)' : SERIES[1] }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 16, marginBottom: 0,
                        maxWidth: '76ch' }}>
              The genuinely hard class is <strong style={{ color: 'var(--amber)' }}>missense</strong>,
              where accuracy falls to{' '}
              {(m.by_consequence.find((r: any) => r.consequence === 'missense')?.accuracy * 100 || 0).toFixed(1)}%.
              And the hardest missense variants are not in the labelled set at all —
              they are the ones ClinVar still calls uncertain. That is exactly the
              population the VUS Resolver targets.
            </p>
          </Panel>
        )}

        {m.decision_surfaces && (
          <Panel title="Decision boundaries on the encoding plane"
                 note="The same 2-D slice through the encoding space, scored by each model. Aqua is benign, magenta is pathogenic, and the white contour is the 0.5 decision boundary. Dots are training variants. The classical models carve axis-aligned or smooth regions; the quantum kernel produces a boundary shaped by the entangling feature map.">
            <div className="grid cols-4" style={{ gap: 18, marginTop: 4 }}>
              {[['random_forest', 'Random Forest'], ['svm', 'SVM (RBF)'],
                ['qsvm', 'QSVM · quantum kernel'], ['vqc', 'VQC']].map(([k, label]) => (
                <DecisionSurface key={k} title={label}
                  values={m.decision_surfaces.surfaces[k]}
                  resolution={m.decision_surfaces.resolution}
                  extent={m.decision_surfaces.extent}
                  points={m.decision_surfaces.points} />
              ))}
            </div>
            <p className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 12 }}>
              AXES: FIRST TWO ENCODING ANGLES, 0 TO π · REMAINING ANGLES HELD AT THEIR TRAINING MEDIAN
            </p>
          </Panel>
        )}

        <Panel title="Ablation · does curation metadata help?">
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', maxWidth: '76ch' }}>
            ClinVar records carry review status and submitter counts. Those fields
            describe how thoroughly a variant has been curated, not what the variant
            does — a model leaning on them is partly reading the label off the
            curation process. The headline models here use molecular features only;
            adding curation metadata moves accuracy from{' '}
            <span className="mono">{(m.ablation_curation_metadata.molecular_only * 100).toFixed(2)}%</span>{' '}
            to{' '}
            <span className="mono">{(m.ablation_curation_metadata.molecular_plus_curation * 100).toFixed(2)}%</span>{' '}
            ({m.ablation_curation_metadata.difference_points >= 0 ? '+' : ''}
            {m.ablation_curation_metadata.difference_points} points), which is
            reported here rather than folded into the headline.
          </p>
        </Panel>
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
