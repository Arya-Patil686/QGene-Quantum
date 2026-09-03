import { useEffect, useRef, useState } from 'react';
import { api, platform, type PlatformOverview } from '../lib/api';
import { useReveal } from '../lib/motion';

function Section({ n, title, children }: {
  n: string; title: string; children: React.ReactNode;
}) {
  return (
    <section className="reveal method-section" style={{
      display: 'grid', gridTemplateColumns: 'minmax(0, 210px) minmax(0, 1fr)',
      gap: 40, padding: '38px 0', borderTop: '1px solid var(--line-soft)' }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--violet-soft)' }}>{n}</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 26,
                     margin: '8px 0 0', lineHeight: 1.15 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-dim)', maxWidth: '70ch' }}>{children}</div>
    </section>
  );
}

const Formula = ({ children }: { children: React.ReactNode }) => (
  <div className="mono" style={{
    padding: '14px 18px', borderRadius: 10, background: 'rgba(124,92,255,.07)',
    border: '1px solid rgba(124,92,255,.22)', fontSize: 12.5, color: 'var(--ink)',
    margin: '14px 0', overflowX: 'auto', whiteSpace: 'pre',
  }}>{children}</div>
);

const DELIVERABLES: [string, string, string][] = [
  ['1 · Pre-processing and feature engineering',
   'ml/pipeline.py',
   'Constant-column removal, median imputation, tail clipping for noise, standardisation, mutual-information feature selection, PCA. Every step is fitted on the training split only and reported back to the interface as a stage card.'],
  ['2 · Hybrid quantum-classical architecture',
   'ml/pipeline.py · ml/quantum.py',
   'A classical front-end reduces any table to as many components as there are qubits, rescales them to [0, π] and prepares an entangled register through a ZZFeatureMap. Everything downstream of that point is quantum.'],
  ['3 · Quantum machine learning models',
   'ml/quantum.py',
   'A quantum-kernel SVM on the fidelity kernel, a variational quantum classifier with a RealAmplitudes ansatz, and a data re-uploading quantum neural network trained by SPSA — three genuinely different parameterised-circuit approaches, not one wrapped three ways.'],
  ['4 · Prediction and decision support',
   'backend/platform_core.py',
   'A calibrated probability, a five-band risk ladder checked against the observed outcome rate in each band, a full sensitivity/specificity sweep with screening and confirmation presets, and a conformal predictor that can decline to answer.'],
  ['5 · Software platform',
   'backend/app.py · web/',
   'A REST API and this interface: a dataset catalogue, per-dataset benchmark dashboards, an inference view, and a studio that ingests a user CSV and trains the whole stack on it in the browser.'],
];

export default function Method() {
  const scope = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<any>(null);
  const [ov, setOv] = useState<PlatformOverview | null>(null);
  useEffect(() => {
    api.metrics().then(setM).catch(() => {});
    platform.overview().then(setOv).catch(() => {});
  }, []);
  useReveal(scope, [m, ov]);

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">Method</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '17ch' }}>
          How the platform works, and what it cannot do.
        </h1>

        <Section n="01" title="The problem statement">
          <p>
            SIH 26139 asks for a hybrid quantum machine learning platform for
            early disease detection: classical pre-processing feeding
            quantum-enhanced models, applied to biomedical datasets across
            cancer, cardiovascular and neurological conditions, with
            explainability, decision support and benchmarking against purely
            classical baselines.
          </p>
          <p>
            The word doing the work is <em>platform</em>. A single-disease
            classifier would not answer it, so the pipeline here is written once
            and applied unchanged to five datasets spanning four clinical
            domains and four data modalities — genomics, imaging-derived
            features, clinical records and voice signal — plus anything a user
            uploads.
          </p>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {DELIVERABLES.map(([title, where, what]) => (
              <div key={title} style={{ padding: '14px 16px', borderRadius: 12,
                                        border: '1px solid var(--line-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                              gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--ink)', fontSize: 13.5,
                                   fontWeight: 500 }}>{title}</strong>
                  <span className="mono" style={{ fontSize: 10,
                                                  color: 'var(--ink-faint)' }}>{where}</span>
                </div>
                <p style={{ margin: '7px 0 0', fontSize: 13 }}>{what}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section n="02" title="Datasets">
          <p>
            Five public datasets, each kept in raw form — missing values and all,
            because handling them is part of the deliverable rather than
            something to tidy away beforehand.
          </p>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5,
                            minWidth: 560 }}>
              <thead>
                <tr>{['Dataset', 'Domain', 'Modality', 'n', 'Features', 'Missing'].map((h) => (
                  <th key={h} className="mono" style={{
                    textAlign: ['n', 'Features', 'Missing'].includes(h) ? 'right' : 'left',
                    padding: '9px 8px', fontSize: 9, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--ink-faint)',
                    fontWeight: 400, borderBottom: '1px solid var(--line)' }}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {(ov?.catalogue ?? []).map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '9px 8px', color: 'var(--ink)' }}>{d.disease}</td>
                    <td style={{ padding: '9px 8px' }}>{d.domain}</td>
                    <td style={{ padding: '9px 8px' }}>{d.modality}</td>
                    <td className="mono" style={{ padding: '9px 8px', textAlign: 'right' }}>
                      {d.n_samples.toLocaleString()}
                    </td>
                    <td className="mono" style={{ padding: '9px 8px', textAlign: 'right' }}>
                      {d.n_features}
                    </td>
                    <td className="mono" style={{ padding: '9px 8px', textAlign: 'right',
                                                  color: d.missing_rate > 0 ? 'var(--amber)' : 'var(--ink-faint)' }}>
                      {(d.missing_rate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 16 }}>
            Splits are 60/20/20 stratified on the outcome, except for the
            genomics dataset, which is split at variant level for the reason set
            out in section 06.
          </p>
        </Section>

        <Section n="03" title="Quantum encoding and the kernel">
          <p>
            Components are rescaled to [0, π] and encoded through a ZZFeatureMap
            with two repetitions and full pairwise entanglement. The fidelity
            kernel is normally evaluated with one circuit per <em>pair</em> of
            samples, which is O(n²). Under statevector simulation it has an exact
            closed form:
          </p>
          <Formula>{`K(x, y) = |⟨φ(x)|φ(y)⟩|²        →        K = |Ψ Ψ†|²`}</Formula>
          <p>
            so each state is prepared once and the Gram matrix is a single
            product. The feature map is written analytically too — after the
            Hadamard layer each repetition is diagonal, with
          </p>
          <Formula>{`φ(x, b) = 2 Σᵢ xᵢbᵢ + 2 Σᵢ<ⱼ (π − xᵢ)(π − xⱼ)(bᵢ ⊕ bⱼ)`}</Formula>
          <p>
            which vectorises over the whole batch in NumPy. Both this and the
            QNN's gate application are checked against Qiskit's own simulator on
            every training run
            {m?.quantum && <>, agreeing to{' '}
              <span className="mono">
                {Number(m.quantum.kernel_max_deviation_vs_qiskit).toExponential(1)}
              </span></>}.
            That speed is what makes the diagnostic sweep in section 04 and
            browser-speed training in the studio possible at all.
          </p>
        </Section>

        <Section n="04" title="Does quantum actually help?">
          <p>
            The honest answer on these datasets is: sometimes, and the platform
            measures which. The quantum branch produces the best single model on
            two of the five bundled datasets and loses on the other three.
          </p>
          <p>
            More usefully, the platform can say <em>why</em> before anything is
            trained. Two numbers describe a quantum kernel's prospects:
            <strong style={{ color: 'var(--ink)' }}> kernel-target alignment</strong>,
            how much the kernel's similarity structure already agrees with the
            labels, and <strong style={{ color: 'var(--ink)' }}> off-diagonal
            spread</strong>, how much the fidelities vary at all.
          </p>
          <p>
            On every dataset here the spread roughly halves with each qubit
            added, collapsing towards a kernel matrix that is effectively the
            identity — the exponential concentration described by Thanasilp et
            al. (2024). A concentrated kernel cannot separate anything, and that
            is exactly what the QSVM's collapsed sensitivity on the smaller
            datasets looks like. Reporting it up front is more useful than
            discovering it after a training run.
          </p>
        </Section>

        <Section n="05" title="Decision support">
          <p>
            A probability on its own is not decision support. Each dataset also
            gets a five-band risk ladder whose bands are validated against the
            observed outcome rate in the held-out set, and a full threshold sweep
            so the operating point can be moved deliberately — a screening pass
            and a confirmatory test want opposite ends of the sensitivity /
            specificity trade.
          </p>
          <p>
            On top of that, a class-conditional split conformal predictor turns
            the ensemble probability into a prediction set with a
            distribution-free coverage guarantee:
          </p>
          <Formula>{`q_c = Quantile( s_c , ⌈(n_c + 1)(1 − α)⌉ / n_c )`}</Formula>
          <p>
            One label in the set is a committed call; both, or neither, is an
            abstention. Where the calibration split is smaller than a couple of
            hundred rows the guarantee is loose, and the platform says so rather
            than quoting it as though it held.
          </p>
        </Section>

        <Section n="06" title="The genomics deep-dive">
          <p>
            The BRCA1/BRCA2 dataset is carried further than the rest, because
            genomics is where the platform's pre-processing has the most to do.
            Variants are described by molecular features parsed from HGVS
            notation: consequence class, Grantham chemical distance between the
            reference and substituted residue, hydropathy and charge shifts,
            functional-domain membership and splice proximity.
          </p>
          {m?.leakage && (
            <p>
              It also carries a correction. ClinVar publishes every variant once
              per genome assembly, so splitting rows rather than variants puts
              the same variant on both sides of the split. Reproducing that
              mistake inflates accuracy by{' '}
              <strong style={{ color: 'var(--amber)' }}>
                {m.leakage.inflation_points.toFixed(2)} points
              </strong>{' '}
              over {m.leakage.variants_shared_between_train_and_test.toLocaleString()}{' '}
              shared variants. Every genomics figure here uses a variant-level split.
            </p>
          )}
          <p>
            And it keeps what other predictors discard: the{' '}
            {m?.dataset ? m.dataset.n_vus.toLocaleString() : 'thousands of'}{' '}
            variants ClinVar still calls uncertain or conflicting are scored and
            ranked for reclassification priority rather than dropped for having
            no label.
          </p>
        </Section>

        <Section n="07" title="Limitations">
          <p>
            <strong style={{ color: 'var(--ink)' }}>Quantum models are simulated.</strong>{' '}
            Everything runs as statevector simulation on a classical machine. No
            claim of quantum speed-up on hardware is made or implied. The
            interest is in whether the kernel geometry is useful, and the honest
            finding is that it mostly is not at these register widths.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>The PCA bottleneck costs accuracy.</strong>{' '}
            Six qubits means six components. The quantum models see less than the
            classical ones, and their scores should be read with that handicap.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Small datasets, loose guarantees.</strong>{' '}
            Three of the five bundled datasets have fewer than 800 rows.
            Test-set estimates on a few dozen positives carry wide confidence
            intervals, and the conformal guarantee is correspondingly loose.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Benchmark data is not clinical data.</strong>{' '}
            These are public research datasets with known population biases.
            Nothing here is validated for diagnostic use, and no output should
            inform a medical decision.
          </p>
        </Section>

        <Section n="08" title="Team and attribution">
          <p>
            Built for Smart India Hackathon 2026, problem statement 26139, by
            team <strong style={{ color: 'var(--ink)' }}>Bugs Janta Party</strong> (800C4B).
          </p>
          <p>
            The BRCA genomics component began as a project by{' '}
            <strong style={{ color: 'var(--ink)' }}>Ananya Choudhari</strong> — the
            original hybrid classifier, ClinVar pipeline, SHAP layer and first
            web application live at{' '}
            <a href="https://github.com/ananyac9820/QGene" target="_blank" rel="noreferrer"
               style={{ borderBottom: '1px solid var(--line)' }}>github.com/ananyac9820/QGene</a>.
            This platform generalises that work to arbitrary biomedical datasets
            and adds the pre-processing pipeline, the QNN, the kernel
            diagnostics, conformal abstention, decision support and the studio.
          </p>
        </Section>

        <Section n="09" title="References">
          <ol className="mono" style={{ fontSize: 11.5, lineHeight: 2, paddingLeft: 18,
                                        color: 'var(--ink-faint)' }}>
            <li>Havlíček et al. Supervised learning with quantum-enhanced feature spaces. Nature 567, 2019.</li>
            <li>Schuld &amp; Killoran. Quantum machine learning in feature Hilbert spaces. PRL 122, 2019.</li>
            <li>Pérez-Salinas et al. Data re-uploading for a universal quantum classifier. Quantum 4, 2020.</li>
            <li>Thanasilp et al. Exponential concentration in quantum kernel methods. Nature Communications 15, 2024.</li>
            <li>Huang et al. Power of data in quantum machine learning. Nature Communications 12, 2021.</li>
            <li>Spall. Multivariate stochastic approximation using a simultaneous perturbation gradient. IEEE TAC 37, 1992.</li>
            <li>Vovk, Gammerman &amp; Shafer. Algorithmic Learning in a Random World. Springer, 2005.</li>
            <li>Angelopoulos &amp; Bates. A gentle introduction to conformal prediction. 2021.</li>
            <li>Lundberg &amp; Lee. A unified approach to interpreting model predictions. NeurIPS, 2017.</li>
            <li>Grantham. Amino acid difference formula to help explain protein evolution. Science 185, 1974.</li>
            <li>Landrum et al. ClinVar: improvements to accessing data. Nucleic Acids Research, 2018.</li>
            <li>Street, Wolberg &amp; Mangasarian. Nuclear feature extraction for breast tumor diagnosis. 1993.</li>
            <li>Detrano et al. International application of a new probability algorithm for coronary artery disease. Am J Cardiol 64, 1989.</li>
            <li>Little et al. Exploiting nonlinear recurrence and fractal scaling properties for voice disorder detection. BioMedical Engineering OnLine 6, 2007.</li>
          </ol>
        </Section>
      </div>
      <div style={{ height: 60 }} />
      <style>{`
        @media (max-width: 820px) {
          .method-section { grid-template-columns: minmax(0, 1fr) !important; gap: 16px !important; }
        }
      `}</style>
    </div>
  );
}
