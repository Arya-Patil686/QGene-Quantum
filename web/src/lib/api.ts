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

// ---------------------------------------------------------------------------
// platform: many datasets, one pipeline
// ---------------------------------------------------------------------------

export interface DatasetSummary {
  id: string;
  name: string;
  disease: string;
  domain: string;
  modality: string;
  n_samples: number;
  n_features: number;
  missing_rate: number;
  prevalence: number;
  positive_label: string;
  negative_label: string;
  source: string;
  description: string;
  n_qubits: number;
  notes: string;
}

export interface ModelResult {
  family: 'classical' | 'quantum' | 'hybrid';
  accuracy: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  f1: number;
  balanced_accuracy: number;
  roc_auc: number;
  pr_auc: number;
  mcc: number;
  brier: number;
  confusion: { tn: number; fp: number; fn: number; tp: number };
  train_seconds: number;
  inference_ms_per_sample: number;
}

export interface PipelineStage {
  stage: string;
  detail: string;
  n_features: number;
}

export interface ThresholdRow {
  threshold: number; sensitivity: number; specificity: number;
  precision: number; f1: number; youden: number; flagged: number;
}

export interface RiskTier {
  tier: string; lower: number; upper: number; n: number;
  share: number; observed_positive_rate: number | null;
}

export interface KernelDiagnostics {
  sweep: {
    qubits: number; alignment: number; off_diagonal_mean: number;
    off_diagonal_std: number; variance_retained: number;
  }[];
  best_qubits: number | null;
  best_alignment: number | null;
  concentrating: boolean;
  verdict: string;
}

export interface DatasetRecord {
  dataset: DatasetSummary;
  stages: PipelineStage[];
  models: Record<string, ModelResult>;
  hybrid_weight: number;
  conformal: {
    alpha: number; target_coverage: number; empirical_coverage: number;
    singleton_rate: number; abstention_rate: number;
    accuracy_on_confident_calls: number; n_calibration: number;
    guarantee_is_tight: boolean;
  };
  thresholds: ThresholdRow[];
  risk_tiers: RiskTier[];
  roc: Record<string, { fpr: number[]; tpr: number[] }>;
  feature_importance: { feature: string; importance: number }[];
  quantum: Record<string, any>;
  encoding_points: { x: number; y: number; z: number; label: number; p: number }[];
  loss_curves: Record<string, number[]>;
  kernel_diagnostics: KernelDiagnostics;
  model_weights: {
    classical: Record<string, number>;
    quantum: Record<string, number>;
    quantum_share: number;
  };
  best_classical_auc: number;
  best_quantum_auc: number;
  quantum_gap: number;
  fit_seconds: number;
  config: Record<string, any>;
}

export interface PlatformOverview {
  generated: string;
  order: string[];
  catalogue: DatasetSummary[];
  comparison: {
    dataset: string; name: string; domain: string; n_samples: number;
    classical: number; quantum: number; hybrid: number;
    gap: number; quantum_weight: number;
  }[];
}

export interface FeatureSchema {
  name: string; median: number; min: number; max: number;
}

export interface DetectResult {
  dataset: string;
  disease: string;
  probability: number;
  prediction: string;
  threshold: number;
  risk: { tier: string; lower: number; upper: number };
  models: Record<string, number>;
  weights: { classical: number; quantum: number };
  uncertainty: { quantum_classical_disagreement: number; margin: number };
  conformal: { set: string[]; status: string; verdict: string; confidence_level: number };
  quantum_state: QuantumState;
  explanation?: { feature: string; value: number; contribution: number; direction: string }[];
  latency_ms: number;
}

export interface UploadProfile {
  id: string;
  rows: number;
  columns: {
    name: string; dtype: string; missing: number; unique: number;
    numeric: boolean; binary: boolean; sample: string[];
  }[];
  target_candidates: string[];
  suggested_target: string | null;
  preview: Record<string, string>[];
}

export const platform = {
  overview: () => get<PlatformOverview>('/api/platform'),
  dataset: (id: string) => get<DatasetRecord>(`/api/platform/${id}`),
  schema: (id: string) =>
    get<{ dataset: DatasetSummary; features: FeatureSchema[] }>(
      `/api/platform/${id}/schema`),
  detect: async (id: string, values: Record<string, number>,
                 threshold = 0.5): Promise<DetectResult> => {
    const r = await fetch(`${BASE}/api/platform/${id}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, threshold }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`);
    return data as DetectResult;
  },
  profile: async (file: File): Promise<UploadProfile> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('id', 'session');
    const r = await fetch(`${BASE}/api/studio/profile`, { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Upload failed');
    return data as UploadProfile;
  },
  train: async (target: string, name: string, nQubits: number): Promise<DatasetRecord> => {
    const r = await fetch(`${BASE}/api/studio/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'session', target, name, n_qubits: nQubits }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Training failed');
    return data as DatasetRecord;
  },
};

export const DOMAIN_COLOUR: Record<string, string> = {
  cancer: '#d55181',
  cardiovascular: '#e0666a',
  neurological: '#9085e9',
  metabolic: '#c98500',
  uploaded: '#199e70',
};
