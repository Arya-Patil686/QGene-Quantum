interface Props {
  gene: string;
  length: number;
  position: number | null;
  domains: { name: string; start: number; end: number }[];
}

const COLOURS = ['#7c5cff', '#22d3ee', '#f472b6', '#fbbf24', '#34d399'];

/** Where the variant falls along the protein, against its functional domains. */
export default function ProteinTrack({ gene, length, position, domains }: Props) {
  const W = 100; // percentage space
  const x = (aa: number) => (aa / length) * W;

  return (
    <div>
      <div style={{ position: 'relative', height: 88, marginTop: 8 }}>
        <div style={{
          position: 'absolute', top: 26, left: 0, right: 0, height: 12,
          borderRadius: 6, background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--line)',
        }} />
        {domains.map((d, i) => (
          <div key={d.name}
               title={`${d.name}  ${d.start}-${d.end}`}
               style={{
                 position: 'absolute', top: 26, height: 12, borderRadius: 6,
                 left: `${x(d.start)}%`, width: `${x(d.end) - x(d.start)}%`,
                 background: COLOURS[i % COLOURS.length], opacity: 0.75,
               }} />
        ))}
        {domains.map((d, i) => (
          <div key={`${d.name}-label`} style={{
            position: 'absolute', top: 42, left: `${x((d.start + d.end) / 2)}%`,
            fontFamily: 'var(--mono)', fontSize: 8.5, color: COLOURS[i % COLOURS.length],
            whiteSpace: 'nowrap',
            // stagger across three rows so adjacent domain labels cannot collide
            transform: `translateX(-50%) translateY(${(i % 3) * 11}px)`,
          }}>{d.name}</div>
        ))}
        {position !== null && (
          <div style={{ position: 'absolute', left: `${x(position)}%`, top: 4 }}>
            <div style={{
              width: 2, height: 44, background: '#ffffff',
              boxShadow: '0 0 12px rgba(255,255,255,0.9)',
            }} />
            <div style={{
              position: 'absolute', top: -4, left: -4, width: 10, height: 10,
              borderRadius: 99, background: '#fff',
            }} />
            <div style={{
              position: 'absolute', top: -20, left: 0, transform: 'translateX(-50%)',
              fontFamily: 'var(--mono)', fontSize: 10, color: '#fff', whiteSpace: 'nowrap',
            }}>{position}</div>
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)',
                                     display: 'flex', justifyContent: 'space-between' }}>
        <span>1</span>
        <span>{gene} · {length} aa</span>
        <span>{length}</span>
      </div>
    </div>
  );
}
