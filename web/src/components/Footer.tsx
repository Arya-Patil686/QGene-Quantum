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
              A hybrid quantum–classical machine learning platform for early
              disease detection across genomics, imaging, clinical records and
              voice biomarkers.
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Project</p>
            <p style={{ color: 'var(--ink-dim)', fontSize: 13, margin: 0, lineHeight: 1.9 }}>
              Smart India Hackathon 2026<br />
              Problem Statement 26139<br />
              Hybrid Quantum ML Platform for Early Disease Detection<br />
              Team Bugs Janta Party · 800C4B
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Important</p>
            <p style={{ color: 'var(--ink-faint)', fontSize: 12, margin: 0, maxWidth: '38ch' }}>
              A research prototype. Predictions are not clinically validated and
              must never inform a medical decision. Speak to a qualified
              clinician.
            </p>
          </div>
        </div>
        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--line-soft)',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
            DATA · CLINVAR · UCI · WISCONSIN · NIDDK
          </span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
            QISKIT 2.5 · SCIKIT-LEARN 1.9 · REACT THREE FIBER
          </span>
        </div>
      </div>
    </footer>
  );
}
