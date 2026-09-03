export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line-soft)', marginTop: 40 }}>
      <div className="wrap" style={{ padding: '46px 0 60px' }}>
        <div className="grid cols-3" style={{ gap: 32 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, marginBottom: 10 }}>
              QGene
            </div>
            <p style={{ color: 'var(--ink-dim)', fontSize: 13, maxWidth: '34ch', margin: 0 }}>
              Hybrid quantum–classical prediction of BRCA1 and BRCA2 variant
              pathogenicity, built on NCBI ClinVar.
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Project</p>
            <p style={{ color: 'var(--ink-dim)', fontSize: 13, margin: 0, lineHeight: 1.9 }}>
              FF No. 180 · Group 16<br />
              Department of Computer Engineering<br />
              Vishwakarma Institute of Technology, Pune
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Important</p>
            <p style={{ color: 'var(--ink-faint)', fontSize: 12, margin: 0, maxWidth: '38ch' }}>
              A research prototype. Predictions are not clinically validated and
              must never inform a medical decision. Speak to a qualified genetic
              counsellor.
            </p>
          </div>
        </div>
        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--line-soft)',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
            DATA · NCBI CLINVAR · VARIANT_SUMMARY
          </span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
            QISKIT 2.5 · SCIKIT-LEARN 1.9 · REACT THREE FIBER
          </span>
        </div>
      </div>
    </footer>
  );
}
