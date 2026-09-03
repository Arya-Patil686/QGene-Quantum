interface Row {
  feature: string; value: number; contribution: number; direction: string;
}

const PRETTY: Record<string, string> = {
  gene: 'Gene (BRCA1 / BRCA2)',
  var_type: 'Variant class',
  cdna_pos_rel: 'cDNA position (relative)',
  intron_offset_abs: 'Distance into intron',
  is_intronic: 'Intronic',
  is_splice_site: 'Splice site (±2 nt)',
  is_utr: 'Untranslated region',
  aa_pos_rel: 'Protein position (relative)',
  log_var_len: 'Variant length',
  is_truncating: 'Truncating',
  is_frameshift: 'Frameshift',
  is_nonsense: 'Stop gained',
  is_missense: 'Missense',
  is_synonymous: 'Synonymous',
  is_inframe_indel: 'In-frame indel',
  in_critical_domain: 'In a functional domain',
  domain_idx: 'Which domain',
  grantham: 'Grantham chemical distance',
  d_hydropathy: 'Hydropathy change',
  d_charge: 'Charge change',
  d_volume: 'Residue volume change',
  is_transition: 'Transition substitution',
};

export default function ShapChart({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.contribution)), 1e-6);

  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {rows.map((r) => {
        const w = (Math.abs(r.contribution) / max) * 50;
        const pathogenic = r.contribution > 0;
        return (
          <div key={r.feature} style={{ display: 'grid',
                                        gridTemplateColumns: '1fr 150px 62px',
                                        alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
              {PRETTY[r.feature] ?? r.feature}
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)',
                                              marginLeft: 7 }}>
                {Number.isInteger(r.value) ? r.value : r.value.toFixed(2)}
              </span>
            </div>
            <div style={{ position: 'relative', height: 16 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0,
                            width: 1, background: 'var(--line)' }} />
              <div style={{
                position: 'absolute', top: 3, height: 10, borderRadius: 3,
                left: pathogenic ? '50%' : `${50 - w}%`,
                width: `${w}%`,
                background: pathogenic ? 'var(--rose)' : 'var(--emerald)',
                opacity: 0.85,
              }} />
            </div>
            <div className="mono" style={{ fontSize: 10.5, textAlign: 'right',
                                           color: pathogenic ? '#ff8098' : '#6ee7b7' }}>
              {r.contribution > 0 ? '+' : ''}{r.contribution.toFixed(3)}
            </div>
          </div>
        );
      })}
      <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)',
                                     display: 'flex', justifyContent: 'space-between',
                                     marginTop: 4 }}>
        <span>← towards benign</span>
        <span>towards pathogenic →</span>
      </div>
    </div>
  );
}
