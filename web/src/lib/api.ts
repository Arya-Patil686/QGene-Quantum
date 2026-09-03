export interface Annotation {
  gene: string;
  consequence: string;
  cdna_position: number;
  protein_position: number | null;
  aa_change: string | null;
  domain: string | null;
  grantham: number | null;
  intron_offset: number | null;
}

export interface BlochVector {
  qubit: number; x: number; y: number; z: number; purity: number;
}

export interface GateOp {
  rep: number; gate: string; qubits: number[]; angle?: number;
}

export interface QuantumState {
  n_qubits: number;
  angles: number[];
  bloch: BlochVector[];
  amplitudes: { state: string; probability: number; phase: number }[];
  entanglement_entropy: number;
  neighbours: { fidelity: number; label: string }[];
  circuit: GateOp[];
}

export interface PredictResult {
  input: Record<string, unknown>;
  annotation: Annotation;
  prediction: 'Pathogenic' | 'Benign';
  pathogenic_probability: number;
  confidence: number;
  models: Record<string, number>;
  weights: { classical: number; quantum: number };
  uncertainty: {
    quantum_classical_disagreement: number;
    margin: number;
    flag: 'low' | 'moderate' | 'high';
  };
  conformal: {
    set: string[];
    status: 'committed' | 'abstained';
    verdict: string;
    confidence_level: number;
    p_values: Record<string, number>;
    credibility: number;
    confidence: number;
    thresholds: Record<string, number>;
  };
  quantum: QuantumState;
  protein_track: {
    gene: string;
    length: number;
    position: number | null;
    domains: { name: string; start: number; end: number }[];
  };
  explanation?: {
    feature: string; value: number; contribution: number; direction: string;
  }[];
  latency_ms: number;
}

export interface VusRecord {
  variation_id: string;
  gene: string;
  name: string;
  current_classification: string;
  consequence: string;
  protein_position: number | null;
  domain: string | null;
  grantham: number | null;
  predicted: string;
  pathogenic_probability: number;
  classical: number;
  quantum: number;
  disagreement: number;
  conformal_status: string;
  conformal_set: string[];
  priority: number;
  review_status: string;
  n_submitters: number;
}

const BASE = import.meta.env.DEV ? 'http://localhost:5001' : '';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} responded ${r.status}`);
  return r.json() as Promise<T>;
}

export const api = {
  predict: async (payload: Record<string, unknown>): Promise<PredictResult> => {
    const r = await fetch(`${BASE}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`);
    return data as PredictResult;
  },
  metrics: () => get<any>('/api/metrics'),
  examples: () => get<{ name: string; label: string; note: string }[]>('/api/examples'),
  vus: (limit = 120, gene?: string) =>
    get<{ summary: any; total: number; variants: VusRecord[] }>(
      `/api/vus?limit=${limit}${gene ? `&gene=${gene}` : ''}`),
  batch: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${BASE}/api/batch`, { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Batch failed');
    return data as { total: number; results: any[] };
  },
};

export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const pct0 = (v: number) => `${Math.round(v * 100)}%`;
