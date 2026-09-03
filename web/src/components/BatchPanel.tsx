import { useRef, useState } from 'react';
import { api } from '../lib/api';

const TEMPLATE = `name
NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)
NM_000059.4(BRCA2):c.5946del (p.Ser1982fs)
NM_007294.4(BRCA1):c.4837A>G (p.Ser1613Gly)
NM_000059.4(BRCA2):c.9976A>T (p.Lys3326Ter)`;

export default function BatchPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const r = await api.batch(file);
      setRows(r.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'qgene_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResults = () => {
    if (!rows) return;
    const cols = ['row', 'name', 'gene', 'consequence', 'prediction',
                  'pathogenic_probability', 'conformal', 'uncertainty'];
    const csv = [cols.join(',')]
      .concat(rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'qgene_batch_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel reveal" style={{ marginTop: 22 }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>Batch scoring</p>
      <p style={{ fontSize: 13, color: 'var(--ink-dim)', maxWidth: '70ch' }}>
        Upload a CSV with a <span className="mono">name</span> column of HGVS
        descriptions — up to 500 rows. Each is scored through the same pipeline,
        including the conformal decision.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <input ref={input} type="file" accept=".csv,text/csv" hidden
               onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button className="btn btn-primary" disabled={busy}
                onClick={() => input.current?.click()}>
          {busy ? 'Scoring…' : 'Upload CSV'}
        </button>
        <button className="btn" onClick={downloadTemplate}>Download template</button>
        {rows && <button className="btn" onClick={downloadResults}>Export results</button>}
      </div>

      {error && <p style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</p>}

      {rows && (
        <div style={{ marginTop: 18, overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                {['#', 'Variant', 'Consequence', 'Call', 'P(path)', 'Conformal', 'Uncertainty']
                  .map((h) => (
                  <th key={h} className="mono" style={{
                    textAlign: h === '#' || h === 'Variant' || h === 'Consequence' ? 'left' : 'right',
                    padding: '9px 10px', fontSize: 9.5, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 400,
                    borderBottom: '1px solid var(--line)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <td className="mono" style={{ padding: '8px 10px', fontSize: 10.5,
                                                color: 'var(--ink-faint)' }}>{r.row}</td>
                  <td className="mono" style={{ padding: '8px 10px', fontSize: 11 }}>
                    {r.name?.replace(/^N[MC]_\d+\.\d+\(BRCA[12]\):/, '')}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11.5, color: 'var(--ink-dim)' }}>
                    {r.error ? <span style={{ color: 'var(--rose)' }}>{r.error}</span> : r.consequence}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {r.prediction && (
                      <span className={`chip ${r.prediction === 'Pathogenic' ? 'chip-path' : 'chip-benign'}`}>
                        {r.prediction}
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ padding: '8px 10px', textAlign: 'right',
                                                fontSize: 11 }}>
                    {r.pathogenic_probability != null
                      ? (r.pathogenic_probability * 100).toFixed(1) : '—'}
                  </td>
                  <td className="mono" style={{ padding: '8px 10px', textAlign: 'right',
                                                fontSize: 10.5, color: 'var(--ink-faint)' }}>
                    {r.conformal ?? '—'}
                  </td>
                  <td className="mono" style={{ padding: '8px 10px', textAlign: 'right',
                                                fontSize: 10.5, color: 'var(--ink-faint)' }}>
                    {r.uncertainty ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
