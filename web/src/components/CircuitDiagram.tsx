import type { GateOp } from '../lib/api';

/**
 * The actual ZZFeatureMap circuit built for the variant on screen, with the
 * rotation angles that this variant's features produced.
 */
export default function CircuitDiagram({ ops, nQubits }: {
  ops: GateOp[]; nQubits: number;
}) {
  const reps = Math.max(...ops.map((o) => o.rep)) + 1;
  const columns: GateOp[][] = [];

  for (let r = 0; r < reps; r++) {
    const inRep = ops.filter((o) => o.rep === r);
    columns.push(inRep.filter((o) => o.gate === 'H'));
    columns.push(inRep.filter((o) => o.gate === 'P'));
    inRep.filter((o) => o.gate === 'ZZ').forEach((o) => columns.push([o]));
  }

  const colW = 46;
  const rowH = 44;
  const padL = 46;
  const width = padL + columns.length * colW + 26;
  const height = nQubits * rowH + 30;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} role="img"
           aria-label="ZZFeatureMap circuit for this variant"
           style={{ display: 'block', minWidth: '100%' }}>
        {Array.from({ length: nQubits }).map((_, q) => (
          <g key={q}>
            <line x1={padL - 12} y1={22 + q * rowH} x2={width - 14} y2={22 + q * rowH}
                  stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
            <text x={10} y={26 + q * rowH} fill="#6b6d8a"
                  fontFamily="var(--mono)" fontSize={11}>{`q${q}`}</text>
          </g>
        ))}

        {columns.map((col, ci) =>
          col.map((op, oi) => {
            const cx = padL + ci * colW + colW / 2 - 12;
            if (op.gate === 'ZZ') {
              const [a, b] = op.qubits;
              const ya = 22 + a * rowH;
              const yb = 22 + b * rowH;
              return (
                <g key={`${ci}-${oi}`}>
                  <line x1={cx} y1={ya} x2={cx} y2={yb}
                        stroke="rgba(124,92,255,0.65)" strokeWidth={1.4} />
                  <circle cx={cx} cy={ya} r={3.6} fill="#7c5cff" />
                  <circle cx={cx} cy={yb} r={3.6} fill="#7c5cff" />
                  <title>{`ZZ(${op.angle?.toFixed(2)}) on q${a}, q${b}`}</title>
                </g>
              );
            }
            const y = 22 + op.qubits[0] * rowH;
            const fill = op.gate === 'H' ? 'rgba(34,211,238,0.14)' : 'rgba(124,92,255,0.16)';
            const stroke = op.gate === 'H' ? '#22d3ee' : '#a08cff';
            return (
              <g key={`${ci}-${oi}`}>
                <rect x={cx - 13} y={y - 12} width={26} height={24} rx={6}
                      fill={fill} stroke={stroke} strokeWidth={1} />
                <text x={cx} y={y + 4} textAnchor="middle" fill={stroke}
                      fontFamily="var(--mono)" fontSize={10.5}>{op.gate}</text>
                {op.angle !== undefined && (
                  <text x={cx} y={y - 16} textAnchor="middle" fill="#6b6d8a"
                        fontFamily="var(--mono)" fontSize={8}>
                    {op.angle.toFixed(2)}
                  </text>
                )}
                <title>
                  {op.gate === 'H'
                    ? `Hadamard on q${op.qubits[0]}`
                    : `Phase ${op.angle?.toFixed(3)} rad on q${op.qubits[0]}`}
                </title>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
