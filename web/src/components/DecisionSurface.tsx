import { useEffect, useRef } from 'react';

interface Props {
  values: number[];
  resolution: number;
  points?: { x: number; y: number; label: number }[];
  extent: number[];
  title: string;
  size?: number;
}

/**
 * A probability surface over a 2-D slice of the encoding space. Diverging
 * ramp: aqua for benign, magenta for pathogenic, neutral grey at the 0.5
 * decision boundary, which is also drawn as an explicit contour.
 */
const LOW = [25, 158, 112];    // #199e70
const MID = [56, 56, 53];      // #383835
const HIGH = [213, 81, 129];   // #d55181

function ramp(p: number): [number, number, number] {
  const t = p < 0.5 ? p * 2 : (p - 0.5) * 2;
  const [a, b] = p < 0.5 ? [LOW, MID] : [MID, HIGH];
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export default function DecisionSurface({
  values, resolution, points, extent, title, size = 210,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !values.length) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(resolution, resolution);
    for (let i = 0; i < values.length; i++) {
      // flip y so the origin sits at the bottom-left
      const row = resolution - 1 - Math.floor(i / resolution);
      const col = i % resolution;
      const o = (row * resolution + col) * 4;
      const [r, g, b] = ramp(values[i]);
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }

    const off = document.createElement('canvas');
    off.width = resolution; off.height = resolution;
    off.getContext('2d')!.putImageData(img, 0, 0);

    cv.width = size * 2; cv.height = size * 2;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(off, 0, 0, cv.width, cv.height);

    // decision contour at p = 0.5
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    const cell = cv.width / resolution;
    for (let r = 0; r < resolution - 1; r++) {
      for (let c = 0; c < resolution - 1; c++) {
        const i = r * resolution + c;
        const a = values[i] >= 0.5;
        if (a !== (values[i + 1] >= 0.5) || a !== (values[i + resolution] >= 0.5)) {
          const y = (resolution - 1 - r) * cell;
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(c * cell, y, cell * 0.8, cell * 0.8);
        }
      }
    }

    if (points?.length) {
      const [x0, x1, y0, y1] = extent;
      points.forEach((p) => {
        const px = ((p.x - x0) / (x1 - x0)) * cv.width;
        const py = cv.height - ((p.y - y0) / (y1 - y0)) * cv.height;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = p.label === 1 ? 'rgba(255,190,210,0.9)' : 'rgba(180,255,225,0.9)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.stroke();
      });
    }
  }, [values, resolution, points, extent, size]);

  return (
    <figure style={{ margin: 0 }}>
      <canvas ref={ref} style={{ width: '100%', maxWidth: size, aspectRatio: '1',
                                 borderRadius: 10, display: 'block',
                                 border: '1px solid var(--line)' }} />
      <figcaption className="mono" style={{ fontSize: 10.5, color: 'var(--ink-dim)',
                                            marginTop: 8 }}>{title}</figcaption>
    </figure>
  );
}
