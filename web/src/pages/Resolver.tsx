import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type VusRecord } from '../lib/api';
import { useReveal } from '../lib/motion';

type Sort = 'priority' | 'pathogenic' | 'disagreement';

const SHORT_LABEL: Record<string, string> = {
  'Uncertain significance': 'Uncertain',
  'Conflicting classifications of pathogenicity': 'Conflicting',
  'Uncertain risk allele': 'Uncertain risk',
};

/** Drop the transcript prefix, and abbreviate the long genomic descriptions. */
function shortName(name: string): string {
  const stripped = name.replace(/^N[MC]_\d+\.\d+\((BRCA[12])\):/, '');
  return stripped.length > 38 ? `${stripped.slice(0, 36)}…` : stripped;
}

export default function Resolver() {
  const scope = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ summary: any; total: number; variants: VusRecord[] } | null>(null);
  const [gene, setGene] = useState<'all' | 'BRCA1' | 'BRCA2'>('all');
  const [sort, setSort] = useState<Sort>('priority');
  const [onlyCommitted, setOnlyCommitted] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => { api.vus(400).then(setData).catch(() => {}); }, []);
  useReveal(scope, [data]);

  const rows = useMemo(() => {
    let v = data?.variants ?? [];
    if (gene !== 'all') v = v.filter((r) => r.gene === gene);
    if (onlyCommitted) v = v.filter((r) => r.conformal_status === 'committed');
    if (query.trim()) {
      const q = query.toLowerCase();
      v = v.filter((r) => r.name.toLowerCase().includes(q)
        || (r.domain ?? '').toLowerCase().includes(q)
        || r.consequence.toLowerCase().includes(q));
    }
    const key: Record<Sort, (r: VusRecord) => number> = {
      priority: (r) => -r.priority,
      pathogenic: (r) => -r.pathogenic_probability,
      disagreement: (r) => -r.disagreement,
    };
    return [...v].sort((a, b) => key[sort](a) - key[sort](b)).slice(0, 150);
  }, [data, gene, sort, onlyCommitted, query]);

  const s = data?.summary;

  return (
    <div ref={scope} style={{ paddingTop: 108 }}>
      <div className="wrap">
        <p className="eyebrow">The unique contribution</p>
        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 62px)', maxWidth: '17ch' }}>
          The VUS Resolver.
        </h1>
        <p className="lede" style={{ marginTop: 20 }}>
          Every BRCA1 and BRCA2 variant in ClinVar that is currently unresolved —
          formally uncertain, or with submitters in open disagreement — scored by
          the hybrid model and ranked by how much resolving it would be worth.
          These rows are the ones prediction papers normally throw away.
        </p>

        {s && (
          <div className="grid cols-4 reveal" style={{ marginTop: 34, gap: 22 }}>
            {[
              { v: s.total_unresolved.toLocaleString(), l: 'Unresolved variants scored' },
              { v: s.model_commits.toLocaleString(), l: `Model commits to a call (${Math.round(s.commit_rate * 100)}%)` },
              { v: s.predicted_pathogenic.toLocaleString(), l: 'Predicted pathogenic', c: 'var(--rose)' },
              { v: s.high_disagreement.toLocaleString(), l: 'Flagged: classical and quantum disagree', c: 'var(--amber)' },
            ].map((k) => (
              <div key={k.l} className="panel panel-tight">
                <div className="mono" style={{ fontSize: 27, color: k.c ?? 'var(--ink)',
                                               letterSpacing: '-0.02em' }}>{k.v}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{k.l}</div>
              </div>
            ))}
          </div>
        )}

        <div className="panel reveal" style={{ marginTop: 22, display: 'flex',
                                               gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="q">Filter</label>
            <input id="q" value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="c.1234, BRC-repeats, missense…" />
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label htmlFor="g">Gene</label>
            <select id="g" value={gene} onChange={(e) => setGene(e.target.value as any)}>
              <option value="all">Both</option>
              <option value="BRCA1">BRCA1</option>
              <option value="BRCA2">BRCA2</option>
            </select>
          </div>
          <div style={{ flex: '0 1 200px' }}>
            <label htmlFor="s">Rank by</label>
            <select id="s" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="priority">Reclassification priority</option>
              <option value="pathogenic">Pathogenic probability</option>
              <option value="disagreement">Model disagreement</option>
            </select>
          </div>
          <button className="btn" onClick={() => setOnlyCommitted((v) => !v)}>
            {onlyCommitted ? 'Showing committed calls' : 'Showing all, including abstentions'}
          </button>
        </div>

        <div className="panel reveal" style={{ marginTop: 22, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                {['Variant', 'Consequence', 'Domain', 'ClinVar now', 'Model call',
                  'P(path)', 'Δ', 'Priority'].map((h) => (
                  <th key={h} className="mono" style={{
                    textAlign: h === 'Variant' || h === 'Consequence' || h === 'Domain'
                      || h === 'Current label' ? 'left' : 'right',
                    padding: '13px 12px', fontSize: 9.5, letterSpacing: '.12em',
                    textTransform: 'uppercase', color: 'var(--ink-faint)',
                    borderBottom: '1px solid var(--line)', fontWeight: 400,
                    position: 'sticky', top: 0, background: 'rgba(9,11,22,.9)',
                    backdropFilter: 'blur(8px)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.variation_id}
                    style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <td className="mono" style={{ padding: '11px 12px', fontSize: 11.5,
                                                maxWidth: 250 }}>
                    <a href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${r.variation_id}/`}
                       target="_blank" rel="noreferrer" title={r.name}
                       style={{ color: 'var(--ink)', borderBottom: '1px solid var(--line)',
                                display: 'block', overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortName(r.name)}
                    </a>
                    <div style={{ color: 'var(--ink-faint)', fontSize: 9.5 }}>{r.gene}</div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--ink-dim)' }}>
                    {r.consequence}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 11.5, color: 'var(--ink-dim)' }}>
                    {r.domain ?? '—'}
                  </td>
                  <td style={{ padding: '11px 12px', fontSize: 11, color: 'var(--ink-faint)',
                               whiteSpace: 'nowrap' }}
                      title={r.current_classification}>
                    {SHORT_LABEL[r.current_classification] ?? r.current_classification}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    <span className={`chip ${r.predicted === 'Pathogenic' ? 'chip-path' : 'chip-benign'}`}>
                      {r.predicted}
                    </span>
                  </td>
                  <td className="mono" style={{ padding: '11px 14px', textAlign: 'right',
                                                fontSize: 11.5 }}>
                    {(r.pathogenic_probability * 100).toFixed(1)}
                  </td>
                  <td className="mono" style={{ padding: '11px 14px', textAlign: 'right',
                                                fontSize: 11.5,
                                                color: r.disagreement > 0.25 ? 'var(--amber)' : 'var(--ink-faint)' }}>
                    {r.disagreement.toFixed(3)}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', width: 110 }}>
                    <div style={{ height: 5, background: 'rgba(255,255,255,.07)',
                                  borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${r.priority * 100}%`, height: '100%',
                                    background: 'linear-gradient(90deg, var(--violet), var(--cyan))' }} />
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center',
                                             color: 'var(--ink-faint)', fontSize: 13 }}>
                  {data ? 'Nothing matches those filters.' : 'Loading…'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel reveal" style={{ marginTop: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>How to read this</p>
          <div className="grid cols-3" style={{ gap: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>Priority</strong> combines
              confidence, agreement between the classical and quantum branches, and
              actionability — a confident pathogenic call changes patient management,
              so it ranks above an equally confident benign one.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>Disagreement</strong> is the gap
              between the classical and quantum sub-ensembles. Measured on the test
              set it is only a weak error detector — the plain confidence margin is
              much better — so it is shown here as a secondary flag, not as the
              uncertainty measure. A large value means the two branches are reading
              the variant differently, which is worth a human look.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: 0 }}>
              <strong style={{ color: 'var(--ink)' }}>These are hypotheses.</strong>{' '}
              A prediction on an unresolved variant is a suggestion about where to
              look next, not a classification. Every variant links back to its
              ClinVar record.
            </p>
          </div>
        </div>
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
