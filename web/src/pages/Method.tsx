import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useReveal } from '../lib/motion';

function Section({ n, title, children }: {
  n: string; title: string; children: React.ReactNode;
}) {
  return (
    <section className="reveal" style={{ display: 'grid',
      gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)', gap: 40,
      padding: '38px 0', borderTop: '1px solid var(--line-soft)' }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--violet-soft)' }}>{n}</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 27,
                     margin: '8px 0 0', lineHeight: 1.15 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-dim)', maxWidth: '70ch' }}>{children}</div>
      <style>{`
        @media (max-width: 820px) {
          section { grid-template-columns: minmax(0, 1fr) !important; gap: 16px !important; }
        }
      `}</style>
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

const FEATURES: [string, string][] = [
  ['Consequence class', 'frameshift, stop-gained, missense, synonymous, splice-site, intronic, UTR, in-frame indel — parsed from the HGVS description'],
  ['Grantham distance', 'chemical distance between the reference and substituted amino acid, recomputed from Grantham’s composition, polarity and volume constants'],
  ['Hydropathy, charge and volume change', 'Kyte–Doolittle hydropathy and residue property deltas for the substitution'],
  ['Functional domain', 'whether the residue falls inside a clinically important domain — RING, coiled-coil and BRCT for BRCA1; PALB2-binding, BRC repeats, DNA-binding, NLS for BRCA2'],
  ['Relative position', 'cDNA position over CDS length, and protein position over protein length'],
  ['Splice proximity', 'signed intron offset, and whether the variant sits within two nucleotides of an exon boundary'],
  ['Variant geometry', 'variant class and length, and whether a substitution is a transition or a transversion'],
];

export default function Method() {
  const scope = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<any>(null);
  useEffect(() => { api.metrics().then(setM).catch(() => {}); }, []);
  useReveal(scope, [m]);
  const d = m?.dataset;

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">Method</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '17ch' }}>
          How the system is built, and what it cannot do.
        </h1>

        <Section n="01" title="The task">
          <p>
            BRCA1 and BRCA2 are the best-characterised hereditary breast and ovarian
            cancer genes, and the reference case for variant interpretation. Given a
            variant description, the task is to predict whether it disrupts the
            protein enough to raise cancer risk — pathogenic — or is tolerated.
          </p>
          <p>
            Ground truth comes from NCBI ClinVar, an aggregation of clinical
            laboratory submissions. Pathogenic and likely pathogenic records form the
            positive class, benign and likely benign the negative class.
          </p>
        </Section>

        <Section n="02" title="Dataset">
          <p>
            ClinVar's <span className="mono">variant_summary</span> table lists each
            variant once per genome assembly, so the same variant appears as both a
            GRCh37 and a GRCh38 row. We collapse to one record per VariationID before
            anything else happens, then split on VariationID so no variant can appear
            in both training and test.
          </p>
          {d && (
            <div className="grid cols-3" style={{ gap: 14, margin: '18px 0' }}>
              {[
                { l: 'Raw rows', v: d.n_raw_rows.toLocaleString() },
                { l: 'Duplicate rows removed', v: d.n_duplicate_rows_removed.toLocaleString() },
                { l: 'Labelled variants', v: d.n_labelled.toLocaleString() },
                { l: 'Pathogenic', v: d.n_pathogenic.toLocaleString() },
                { l: 'Benign', v: d.n_benign.toLocaleString() },
                { l: 'Unresolved (VUS + conflicting)', v: d.n_vus.toLocaleString() },
              ].map((k) => (
                <div key={k.l} style={{ padding: '12px 14px', borderRadius: 10,
                                        border: '1px solid var(--line-soft)' }}>
                  <div className="mono" style={{ fontSize: 18, color: 'var(--ink)' }}>{k.v}</div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>{k.l}</div>
                </div>
              ))}
            </div>
          )}
          <p>
            Splits are {d ? `${d.split.train.toLocaleString()} / ${d.split.val.toLocaleString()} / ${d.split.test.toLocaleString()}` : '70 / 15 / 15'}{' '}
            train / validation / test, stratified on both label and gene. The
            validation split is used for the ensemble weight and the conformal
            calibration, and is never used for reporting.
          </p>
        </Section>

        <Section n="03" title="Features">
          <p>
            Features are derived from the variant description and fixed biochemical
            constants only — nothing about how the variant was curated enters the
            headline models.
          </p>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {FEATURES.map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '190px 1fr',
                                    gap: 16, alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{k}</span>
                <span style={{ fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 18 }}>
            The Grantham matrix is recomputed from its published constants rather
            than transcribed, and the implementation asserts five known cells
            (S↔R = 110, L↔I = 5, C↔W = 215, G↔W = 184, D↔E = 45) at import time.
          </p>
        </Section>

        <Section n="04" title="Quantum encoding">
          <p>
            Twenty-two standardised features are reduced to {m?.quantum?.n_qubits ?? 4} principal
            components{m?.quantum && ` (retaining ${(m.quantum.pca_variance_retained * 100).toFixed(1)}% of variance)`},
            rescaled to [0, π], and encoded as rotation angles in a ZZFeatureMap with
            two repetitions and full pairwise entanglement.
          </p>
          <p>
            The fidelity quantum kernel is normally evaluated one circuit per pair of
            samples, which costs O(n²) simulations. Under statevector simulation it has
            an exact closed form:
          </p>
          <Formula>{`K(x, y) = |⟨φ(x)|φ(y)⟩|²`}</Formula>
          <p>
            so each state is prepared once — O(n) — and the Gram matrix is a single
            product. The feature map is also written analytically: after the Hadamard
            layer each repetition is diagonal, with
          </p>
          <Formula>{`φ(x, b) = 2 Σᵢ xᵢbᵢ + 2 Σᵢ<ⱼ (π − xᵢ)(π − xⱼ)(bᵢ ⊕ bⱼ)`}</Formula>
          <p>
            which vectorises across the whole batch. The implementation is checked
            against Qiskit's own simulator on every training run and agrees to{' '}
            <span className="mono">
              {m ? Number(m.quantum.kernel_max_deviation_vs_qiskit).toExponential(1) : '~1e-15'}
            </span>. The practical consequences are that the QSVM trains on{' '}
            {m ? m.quantum.qsvm_train_samples.toLocaleString() : 'thousands of'} samples
            instead of a few hundred, the VQC trains on the full training set, and a
            live prediction returns in single-digit milliseconds.
          </p>
        </Section>

        <Section n="05" title="Models and ensemble">
          <p>
            Four models are trained: a Random Forest and an RBF SVM classically, a
            support vector machine on the precomputed quantum kernel (QSVM), and a
            variational classifier with a RealAmplitudes ansatz optimised by COBYLA.
            The ensemble blends the classical and quantum means with a single weight
            fitted on the validation split by ROC-AUC
            {m && ` — ${(m.hybrid_weights.classical * 100).toFixed(0)}% classical, ${(m.hybrid_weights.quantum * 100).toFixed(0)}% quantum`}.
          </p>
        </Section>

        <Section n="06" title="Abstention">
          <p>
            A class-conditional split conformal predictor turns the ensemble
            probability into a prediction set with a coverage guarantee. Nonconformity
            is 1 − p(true class); for each class the (1 − α) quantile of calibration
            scores gives a threshold, with the finite-sample correction
          </p>
          <Formula>{`q_c = Quantile( s_c , ⌈(n_c + 1)(1 − α)⌉ / n_c )`}</Formula>
          <p>
            A returned set with one label is a committed call. A set with both labels
            means the model is declining to choose. An empty set means the variant
            resembles nothing in the calibration data. The guarantee is
            distribution-free and holds under exchangeability, which the
            variant-level split is designed to preserve.
          </p>
          <p>
            Separately, the gap between the classical and quantum sub-ensembles is
            recorded as an epistemic signal — and reported honestly. As an error
            detector on the test set it reaches AUC{' '}
            <span className="mono">{m ? m.disagreement.auc_disagreement_detects_error.toFixed(3) : '—'}</span>,
            which is <em>worse</em> than the plain confidence margin at{' '}
            <span className="mono">{m ? m.disagreement.auc_margin_detects_error.toFixed(3) : '—'}</span>.
            The two together give{' '}
            <span className="mono">{m ? m.disagreement.auc_combined.toFixed(3) : '—'}</span>.
            So disagreement is surfaced as a secondary flag for human review
            rather than presented as the uncertainty measure; the negative result
            is worth stating rather than burying.
          </p>
        </Section>

        <Section n="07" title="Limitations">
          <p>
            <strong style={{ color: 'var(--ink)' }}>Quantum models are simulated.</strong>{' '}
            Everything runs as statevector simulation on a classical machine. No claim
            of quantum speed-up on hardware is made or implied; the interest is in
            whether the kernel geometry is useful, not in wall-clock advantage.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>The PCA bottleneck costs accuracy.</strong>{' '}
            Four qubits means four components, and the quantum models see less than
            the classical ones. Their scores should be read with that handicap in mind.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>ClinVar labels are consensus, not truth.</strong>{' '}
            Submissions are reclassified over time. A model trained on today's
            consensus inherits today's biases, including under-representation of
            non-European populations.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>No conservation or population frequency.</strong>{' '}
            Established predictors use multiple-sequence-alignment conservation and
            gnomAD allele frequencies. Those are not used here, and adding them is the
            most obvious route to a better model.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Not a clinical tool.</strong>{' '}
            Nothing here is validated for diagnostic use.
          </p>
        </Section>

        <Section n="08" title="Attribution">
          <p>
            QGene began as a project by <strong style={{ color: 'var(--ink)' }}>Ananya Choudhari</strong>,
            who built the original hybrid classifier, the ClinVar pipeline, the SHAP
            explanation layer and the first web application
            (<a href="https://github.com/ananyac9820/QGene" target="_blank" rel="noreferrer"
                style={{ borderBottom: '1px solid var(--line)' }}>github.com/ananyac9820/QGene</a>).
            This build keeps that structure and extends it: a rebuilt leak-free
            dataset, molecular feature engineering, the closed-form quantum kernel,
            conformal abstention, the VUS Resolver and this interface.
          </p>
          <p>
            Project FF No. 180, Group 16 — Ananya Choudhari, Arya Bharat Patil,
            Aryan Bhat and Ankush Kumar. Department of Computer Engineering,
            Vishwakarma Institute of Technology, Pune. Internal guide: Prof. Shilpa Katikar.
          </p>
        </Section>

        <Section n="09" title="References">
          <ol className="mono" style={{ fontSize: 11.5, lineHeight: 2, paddingLeft: 18,
                                        color: 'var(--ink-faint)' }}>
            <li>Landrum et al. ClinVar: improvements to accessing data. Nucleic Acids Research, 2018.</li>
            <li>Havlíček et al. Supervised learning with quantum-enhanced feature spaces. Nature 567, 2019.</li>
            <li>Grantham. Amino acid difference formula to help explain protein evolution. Science 185, 1974.</li>
            <li>Kyte &amp; Doolittle. A simple method for displaying the hydropathic character of a protein. JMB 157, 1982.</li>
            <li>Vovk, Gammerman &amp; Shafer. Algorithmic Learning in a Random World. Springer, 2005.</li>
            <li>Angelopoulos &amp; Bates. A gentle introduction to conformal prediction. 2021.</li>
            <li>Richards et al. ACMG/AMP standards for the interpretation of sequence variants. Genetics in Medicine 17, 2015.</li>
            <li>Lundberg &amp; Lee. A unified approach to interpreting model predictions. NeurIPS, 2017.</li>
          </ol>
        </Section>
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
