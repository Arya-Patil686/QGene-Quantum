const fs = require('fs');
const PptxGenJS = require('pptxgenjs');
const D = JSON.parse(fs.readFileSync('deck_data.json', 'utf8'));

// ---------------------------------------------------------------- palette
const C = {
  ink:       '141428',
  deep:      '2A2560',
  body:      '3B3B52',
  muted:     '76768F',
  faint:     'A9A9BE',
  line:      'DFDDEE',
  tint:      'F5F4FB',
  tint2:     'EFEDFA',
  white:     'FFFFFF',
  classical: '2F6FB5',
  quantum:   '7A4DFF',
  hybrid:    'E08A1E',
  risk:      'D8455F',
  safe:      '1B8A6B',
};
const F = { head: 'Cambria', body: 'Calibri' };
const LOGO = 'unpacked/ppt/media/image1.png';

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'SIH', width: 13.333, height: 7.5 });
pptx.layout = 'SIH';
pptx.author = 'Bugs Janta Party';
pptx.title = 'QGene — Hybrid Quantum ML Platform for Early Disease Detection';

// ---------------------------------------------------------------- helpers
const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, fontFace: F.body }, o));

function chrome(slide, n, section) {
  slide.addImage({ path: LOGO, x: 11.62, y: 0.3, w: 1.36, h: 0.64 });
  txt(slide, 'SIH 2026  ·  PS 26139  ·  Bugs Janta Party  ·  800C4B', {
    x: 0.62, y: 7.02, w: 8, h: 0.28, fontSize: 9, color: C.faint, margin: 0,
  });
  txt(slide, String(n), {
    x: 12.3, y: 7.02, w: 0.42, h: 0.28, fontSize: 9, color: C.faint,
    align: 'right', margin: 0,
  });
  if (section) {
    txt(slide, section.toUpperCase(), {
      x: 0.62, y: 0.42, w: 8, h: 0.26, fontSize: 10, color: C.quantum,
      charSpacing: 2.2, bold: true, margin: 0,
    });
  }
}

function title(slide, t, y) {
  txt(slide, t, {
    x: 0.62, y: y || 0.72, w: 10.6, h: 0.62, fontSize: 34, bold: true,
    color: C.ink, fontFace: F.head, margin: 0,
  });
}

function card(slide, o) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.09,
    fill: { color: o.fill || C.tint },
    line: { color: o.line || C.line, width: 1 },
  });
}

function chip(slide, o) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: o.x, y: o.y, w: o.w, h: o.h || 0.3, rectRadius: 0.15,
    fill: { color: o.fill }, line: { type: 'none' },
  });
  txt(slide, o.label, {
    x: o.x, y: o.y, w: o.w, h: o.h || 0.3, fontSize: o.size || 9.5,
    color: o.color || C.white, align: 'center', valign: 'middle', bold: true,
    margin: 0,
  });
}

function numCircle(slide, x, y, n, colour) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w: 0.34, h: 0.34, fill: { color: colour }, line: { type: 'none' },
  });
  txt(slide, String(n), {
    x, y, w: 0.34, h: 0.34, fontSize: 12, bold: true, color: C.white,
    align: 'center', valign: 'middle', margin: 0,
  });
}

function arrow(slide, x, y, w) {
  slide.addShape(pptx.ShapeType.rightArrow, {
    x, y, w, h: 0.18, fill: { color: C.line }, line: { type: 'none' },
  });
}

// ================================================================ SLIDE 1
{
  const s = pptx.addSlide();
  s.background = { color: C.ink };
  s.addImage({ path: LOGO, x: 11.5, y: 0.42, w: 1.42, h: 0.67 });

  txt(s, 'SMART INDIA HACKATHON 2026', {
    x: 0.7, y: 0.5, w: 8, h: 0.3, fontSize: 11, color: C.quantum,
    charSpacing: 3, bold: true, margin: 0,
  });

  txt(s, 'Hybrid Quantum Machine Learning\nPlatform for Early Disease Detection', {
    x: 0.7, y: 1.2, w: 8.5, h: 2.15, fontSize: 34, bold: true, color: C.white,
    fontFace: F.head, lineSpacing: 42, valign: 'top', margin: 0,
  });

  txt(s, 'One pipeline. Five diseases. Four clinical domains. Plus whatever you upload.', {
    x: 0.7, y: 2.72, w: 8.4, h: 0.4, fontSize: 15, color: 'B9B7D8', italic: true, margin: 0,
  });

  // required submission fields, as compact cards
  const fields = [
    ['Problem Statement ID', '26139'],
    ['PS Category', 'Software'],
    ['Theme', 'MedTech / BioTech / HealthTech'],
    ['Team ID', '800C4B'],
    ['Team Name', 'Bugs Janta Party'],
    ['Prototype', 'Built, benchmarked, open source'],
  ];
  fields.forEach(([k, v], i) => {
    const x = 0.7 + (i % 3) * 2.92;
    const y = 3.55 + Math.floor(i / 3) * 1.0;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 2.72, h: 0.8, rectRadius: 0.08,
      fill: { color: '1F1D3D' }, line: { color: '332F५E'.replace('५', '5'), width: 1 },
    });
    txt(s, k.toUpperCase(), {
      x: x + 0.16, y: y + 0.1, w: 2.4, h: 0.22, fontSize: 7.5, color: '8B88B8',
      charSpacing: 1.4, bold: true, margin: 0,
    });
    txt(s, v, {
      x: x + 0.16, y: y + 0.33, w: 2.4, h: 0.36, fontSize: 12, color: C.white,
      bold: true, margin: 0,
    });
  });

  // quantum register motif, right side
  const qx = 9.55, qy = 1.5;
  for (let q = 0; q < 6; q++) {
    const y = qy + q * 0.5;
    s.addShape(pptx.ShapeType.line, {
      x: qx, y, w: 3.1, h: 0,
      line: { color: '3A3568', width: 1 },
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: qx + 0.35, y: y - 0.14, w: 0.28, h: 0.28, rectRadius: 0.06,
      fill: { color: '2B2A55' }, line: { color: C.quantum, width: 1 },
    });
    txt(s, 'H', { x: qx + 0.35, y: y - 0.14, w: 0.28, h: 0.28, fontSize: 9,
                  color: 'C0B0FF', align: 'center', valign: 'middle', margin: 0 });
  }
  // entangling links
  [[0, 1, 1.15], [1, 2, 1.5], [2, 4, 1.9], [3, 5, 2.3], [0, 3, 2.65]].forEach(([a, b, dx]) => {
    const y1 = qy + a * 0.5, y2 = qy + b * 0.5;
    s.addShape(pptx.ShapeType.line, {
      x: qx + dx, y: Math.min(y1, y2), w: 0, h: Math.abs(y2 - y1),
      line: { color: '6D4AFF', width: 1.4 },
    });
    [y1, y2].forEach((yy) => s.addShape(pptx.ShapeType.ellipse, {
      x: qx + dx - 0.055, y: yy - 0.055, w: 0.11, h: 0.11,
      fill: { color: '8F73FF' }, line: { type: 'none' },
    }));
  });
  txt(s, 'ZZFeatureMap · 6 qubits · full entanglement', {
    x: 9.4, y: 4.6, w: 3.4, h: 0.3, fontSize: 9, color: '7C79A8',
    align: 'center', margin: 0,
  });

  chip(s, { x: 9.55, y: 5.3, w: 1.5, h: 0.34, label: 'QSVM', fill: '2B2A55', color: 'C0B0FF' });
  chip(s, { x: 11.2, y: 5.3, w: 1.5, h: 0.34, label: 'VQC', fill: '2B2A55', color: 'C0B0FF' });
  chip(s, { x: 9.55, y: 5.78, w: 3.15, h: 0.34, label: 'DATA RE-UPLOADING QNN', fill: C.quantum, color: C.white, size: 9 });

  txt(s, 'Team Bugs Janta Party  ·  800C4B', {
    x: 0.7, y: 6.95, w: 6, h: 0.3, fontSize: 9.5, color: '6E6B98', margin: 0,
  });
}

// ================================================================ SLIDE 2
{
  const s = pptx.addSlide();
  chrome(s, 2, 'Proposed solution');
  title(s, 'One pipeline, five diseases');

  txt(s, 'The pipeline never learns which disease it is looking at — so the same code path serves every dataset, and any CSV a user brings.', {
    x: 0.62, y: 1.4, w: 8.9, h: 0.4, fontSize: 12.5, color: C.muted, margin: 0,
  });

  // pipeline flow
  const steps = [
    ['Ingest', 'clean · impute\ndenoise'],
    ['Reduce', 'select · PCA'],
    ['Encode', 'angles → qubits'],
    ['Learn', '3 classical\n3 quantum'],
    ['Decide', 'risk · threshold\nabstain'],
  ];
  const sw = 2.18, gap = 0.32;
  steps.forEach(([t, d], i) => {
    const x = 0.62 + i * (sw + gap);
    card(s, { x, y: 2.0, w: sw, h: 1.5, fill: i === 2 ? C.tint2 : C.tint });
    numCircle(s, x + 0.16, y2 = 2.16, i + 1, i === 2 ? C.quantum : C.deep);
    txt(s, t, { x: x + 0.6, y: 2.18, w: sw - 0.7, h: 0.3, fontSize: 14.5, bold: true,
                color: C.ink, fontFace: F.head, margin: 0 });
    txt(s, d, { x: x + 0.16, y: 2.62, w: sw - 0.32, h: 0.7, fontSize: 10.5,
                color: C.muted, margin: 0 });
    if (i < steps.length - 1) arrow(s, x + sw + 0.06, 2.66, 0.2);
  });

  // disease cards
  const cols = [C.risk, C.risk, C.classical, C.quantum, C.hybrid];
  D.catalogue.forEach((d, i) => {
    const x = 0.62 + i * (sw + gap);
    card(s, { x, y: 3.78, w: sw, h: 1.62, fill: C.white });
    chip(s, { x: x + 0.16, y: 3.94, w: 1.15, h: 0.26, label: d.domain.toUpperCase(),
              fill: cols[i], size: 7 });
    txt(s, d.disease, { x: x + 0.16, y: 4.28, w: sw - 0.32, h: 0.62, fontSize: 12,
                        bold: true, color: C.ink, fontFace: F.head, margin: 0 });
    txt(s, `${d.n.toLocaleString()} × ${d.f}\n${d.modality}`, {
      x: x + 0.16, y: 4.92, w: sw - 0.32, h: 0.44, fontSize: 9.5,
      color: C.muted, margin: 0 });
  });

  // upload callout
  card(s, { x: 0.62, y: 5.62, w: 12.09, h: 0.92, fill: C.tint2, line: 'CFC6F5' });
  txt(s, '+', { x: 0.85, y: 5.72, w: 0.4, h: 0.7, fontSize: 30, color: C.quantum,
                bold: true, align: 'center', valign: 'middle', margin: 0 });
  txt(s, 'Bring your own dataset', {
    x: 1.35, y: 5.78, w: 4, h: 0.34, fontSize: 15, bold: true, color: C.ink,
    fontFace: F.head, margin: 0 });
  txt(s, 'Upload a CSV → profiled, cleaned, encoded, six models trained and benchmarked in the browser — 3.6 seconds on a 569-row table.', {
    x: 1.35, y: 6.12, w: 11.1, h: 0.34, fontSize: 11, color: C.body, margin: 0 });
}

// ================================================================ SLIDE 3
{
  const s = pptx.addSlide();
  chrome(s, 3, 'Technical approach');
  title(s, 'Classical front-end, quantum core');

  // --- classical column
  card(s, { x: 0.62, y: 1.62, w: 3.5, h: 4.35, fill: C.tint });
  txt(s, 'CLASSICAL FRONT-END', { x: 0.82, y: 1.8, w: 3.1, h: 0.26, fontSize: 9,
      color: C.classical, bold: true, charSpacing: 1.6, margin: 0 });
  D.stages.forEach((st, i) => {
    const y = 2.2 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.82, y, w: 3.1, h: 0.4, rectRadius: 0.07,
      fill: { color: C.white }, line: { color: C.line, width: 1 } });
    txt(s, st, { x: 0.98, y, w: 2.4, h: 0.4, fontSize: 11, color: C.body,
                 valign: 'middle', margin: 0 });
  });
  txt(s, 'missing values · noisy tails · mutual information · PCA', {
    x: 0.82, y: 5.68, w: 3.1, h: 0.44, fontSize: 9.5, color: C.muted, margin: 0 });

  // --- quantum column
  card(s, { x: 4.42, y: 1.62, w: 3.9, h: 4.35, fill: '211E4A', line: '211E4A' });
  txt(s, 'QUANTUM REGISTER', { x: 4.62, y: 1.8, w: 3.5, h: 0.26, fontSize: 9,
      color: 'A794FF', bold: true, charSpacing: 1.6, margin: 0 });
  const qx = 4.72;
  for (let q = 0; q < 6; q++) {
    const y = 2.35 + q * 0.34;
    s.addShape(pptx.ShapeType.line, { x: qx, y, w: 3.3, h: 0,
      line: { color: '3E3872', width: 1 } });
    txt(s, `q${q}`, { x: qx - 0.02, y: y - 0.13, w: 0.25, h: 0.26, fontSize: 7.5,
                      color: '6F6AA0', margin: 0 });
    ['H', 'P'].forEach((g, k) => {
      s.addShape(pptx.ShapeType.roundRect, {
        x: qx + 0.42 + k * 0.44, y: y - 0.12, w: 0.26, h: 0.24, rectRadius: 0.05,
        fill: { color: '2E2A60' }, line: { color: '6D4AFF', width: 0.75 } });
      txt(s, g, { x: qx + 0.42 + k * 0.44, y: y - 0.12, w: 0.26, h: 0.24,
                  fontSize: 8, color: 'C6B8FF', align: 'center', valign: 'middle', margin: 0 });
    });
  }
  [[0, 1, 1.75], [1, 3, 2.05], [2, 5, 2.4], [0, 4, 2.75], [3, 5, 3.05]].forEach(([a, b, dx]) => {
    const y1 = 2.35 + a * 0.34, y2 = 2.35 + b * 0.34;
    s.addShape(pptx.ShapeType.line, { x: qx + dx, y: Math.min(y1, y2), w: 0,
      h: Math.abs(y2 - y1), line: { color: '8F73FF', width: 1.3 } });
    [y1, y2].forEach((yy) => s.addShape(pptx.ShapeType.ellipse, {
      x: qx + dx - 0.05, y: yy - 0.05, w: 0.1, h: 0.1,
      fill: { color: 'A794FF' }, line: { type: 'none' } }));
  });
  txt(s, 'ZZFeatureMap · 2 reps · full entanglement', {
    x: 4.62, y: 4.55, w: 3.5, h: 0.26, fontSize: 9, color: '8C88BE', margin: 0 });

  card(s, { x: 4.62, y: 4.92, w: 3.5, h: 0.95, fill: '2E2A60', line: '3E3872' });
  txt(s, 'K(x, y) = |⟨φ(x)|φ(y)⟩|²   →   K = |Ψ Ψ†|²', {
    x: 4.72, y: 5.02, w: 3.3, h: 0.3, fontSize: 11.5, color: 'D6CCFF',
    bold: true, align: 'center', margin: 0 });
  txt(s, 'closed form: O(n) state preparations, not O(n²) circuits', {
    x: 4.72, y: 5.36, w: 3.3, h: 0.42, fontSize: 9, color: '9B96C9',
    align: 'center', margin: 0 });

  // --- models column
  const models = [
    ['Logistic regression', C.classical], ['Random forest', C.classical],
    ['SVM (RBF)', C.classical], ['QSVM  · quantum kernel', C.quantum],
    ['VQC  · RealAmplitudes', C.quantum], ['QNN  · data re-uploading, SPSA', C.quantum],
  ];
  card(s, { x: 8.62, y: 1.62, w: 4.09, h: 4.35, fill: C.tint });
  txt(s, 'SIX MODELS, ONE ENSEMBLE', { x: 8.82, y: 1.8, w: 3.7, h: 0.26, fontSize: 9,
      color: C.deep, bold: true, charSpacing: 1.6, margin: 0 });
  models.forEach(([m, col], i) => {
    const y = 2.2 + i * 0.45;
    s.addShape(pptx.ShapeType.roundRect, { x: 8.82, y, w: 3.69, h: 0.37,
      rectRadius: 0.06, fill: { color: C.white }, line: { color: C.line, width: 1 } });
    s.addShape(pptx.ShapeType.ellipse, { x: 8.96, y: y + 0.125, w: 0.12, h: 0.12,
      fill: { color: col }, line: { type: 'none' } });
    txt(s, m, { x: 9.2, y, w: 3.2, h: 0.37, fontSize: 10.5, color: C.body,
                valign: 'middle', margin: 0 });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 8.82, y: 4.98, w: 3.69, h: 0.52,
    rectRadius: 0.08, fill: { color: C.hybrid }, line: { type: 'none' } });
  txt(s, 'HYBRID  ·  weights fitted on validation', {
    x: 8.82, y: 4.98, w: 3.69, h: 0.52, fontSize: 11, bold: true, color: C.white,
    align: 'center', valign: 'middle', margin: 0 });
  txt(s, 'A failed member cannot drag its family down —\neach is weighted by how far it beats chance.', {
    x: 8.82, y: 5.58, w: 3.69, h: 0.4, fontSize: 9, color: C.muted, margin: 0 });

  arrow(s, 4.16, 3.7, 0.2);
  arrow(s, 8.36, 3.7, 0.2);

  txt(s, 'Qiskit 2.5  ·  scikit-learn 1.9  ·  SHAP  ·  Flask  ·  React + React Three Fiber  ·  Docker', {
    x: 0.62, y: 6.24, w: 12.09, h: 0.32, fontSize: 10, color: C.muted,
    align: 'center', margin: 0 });
}

// ================================================================ SLIDE 4
{
  const s = pptx.addSlide();
  chrome(s, 4, 'Impact and benefits');
  title(s, 'A decision, not just a score');

  // risk ladder — real observed rates
  card(s, { x: 0.62, y: 1.58, w: 6.0, h: 3.35, fill: C.white });
  txt(s, 'EARLY RISK STRATIFICATION', { x: 0.85, y: 1.76, w: 5.5, h: 0.26,
      fontSize: 9, color: C.deep, bold: true, charSpacing: 1.6, margin: 0 });
  txt(s, 'Bands validated against the outcome rate actually observed in each — coronary artery disease, held-out set.', {
    x: 0.85, y: 2.04, w: 5.5, h: 0.44, fontSize: 10, color: C.muted, margin: 0 });
  const tierCols = ['1B8A6B', '5FA36B', 'E0A81E', 'E0704A', 'D8455F'];
  D.risk_tiers.forEach((t, i) => {
    const y = 2.6 + i * 0.44;
    const rate = t.observed_positive_rate === null ? 0 : t.observed_positive_rate;
    txt(s, t.tier, { x: 0.85, y, w: 1.35, h: 0.34, fontSize: 10.5, color: C.body,
                     valign: 'middle', margin: 0 });
    s.addShape(pptx.ShapeType.roundRect, { x: 2.25, y: y + 0.08, w: 3.05, h: 0.18,
      rectRadius: 0.09, fill: { color: C.line }, line: { type: 'none' } });
    if (rate > 0) {
      s.addShape(pptx.ShapeType.roundRect, { x: 2.25, y: y + 0.08,
        w: Math.max(0.18, 3.05 * rate), h: 0.18, rectRadius: 0.09,
        fill: { color: tierCols[i] }, line: { type: 'none' } });
    }
    txt(s, `${Math.round(rate * 100)}%`, { x: 5.4, y, w: 0.95, h: 0.34,
        fontSize: 11, bold: true, color: tierCols[i], valign: 'middle',
        align: 'right', margin: 0 });
  });
  txt(s, 'Observed positive rate climbs from 0% in the lowest band to 90–100% in the top two.', {
    x: 0.85, y: 4.66, w: 5.5, h: 0.26, fontSize: 9, color: C.faint, margin: 0 });

  // threshold tuning
  card(s, { x: 6.82, y: 1.58, w: 5.89, h: 3.35, fill: C.white });
  txt(s, 'THRESHOLD TUNING', { x: 7.05, y: 1.76, w: 5.4, h: 0.26, fontSize: 9,
      color: C.deep, bold: true, charSpacing: 1.6, margin: 0 });
  txt(s, 'Screening and confirmation want opposite ends of the same curve, so the operating point is exposed rather than fixed at 0.5.', {
    x: 7.05, y: 2.04, w: 5.4, h: 0.44, fontSize: 10, color: C.muted, margin: 0 });

  s.addShape(pptx.ShapeType.roundRect, { x: 7.05, y: 2.78, w: 5.4, h: 0.3,
    rectRadius: 0.15, fill: { color: C.line }, line: { type: 'none' } });
  s.addShape(pptx.ShapeType.ellipse, { x: 9.55, y: 2.68, w: 0.5, h: 0.5,
    fill: { color: C.quantum }, line: { color: C.white, width: 2 } });
  [['SCREENING', 'miss nobody\nhigh sensitivity', 7.05, C.risk],
   ['CONFIRMATION', 'few false alarms\nhigh specificity', 10.15, C.safe]].forEach(
    ([t, d, x, col]) => {
      txt(s, t, { x, y: 3.24, w: 2.3, h: 0.26, fontSize: 9.5, bold: true,
                  color: col, margin: 0 });
      txt(s, d, { x, y: 3.5, w: 2.3, h: 0.5, fontSize: 9.5, color: C.muted, margin: 0 });
    });

  const conf = D.conformal_brca;
  card(s, { x: 7.05, y: 4.06, w: 5.4, h: 0.72, fill: C.tint2, line: 'CFC6F5' });
  txt(s, 'AND IT CAN DECLINE', { x: 7.22, y: 4.14, w: 2.6, h: 0.24, fontSize: 8.5,
      color: C.quantum, bold: true, charSpacing: 1.4, margin: 0 });
  txt(s, `Conformal prediction: ${(conf.empirical_coverage * 100).toFixed(1)}% coverage against a ${(conf.target_coverage * 100).toFixed(0)}% target, abstains on ${(conf.abstention_rate * 100).toFixed(0)}%, ${(conf.accuracy_on_confident_calls * 100).toFixed(1)}% accurate when it commits.`, {
    x: 7.22, y: 4.38, w: 5.06, h: 0.34, fontSize: 10, color: C.body, margin: 0 });

  // impact stats
  const stats = [
    [D.total_samples.toLocaleString(), 'patient records across the catalogue'],
    ['4', 'clinical domains, 4 data modalities'],
    [D.vus.toLocaleString(), 'unresolved genomic variants scored'],
    ['3.6 s', 'to train the full stack on your CSV'],
  ];
  stats.forEach(([v, l], i) => {
    const x = 0.62 + i * 3.11;
    card(s, { x, y: 5.12, w: 2.87, h: 1.02, fill: C.tint });
    txt(s, v, { x: x + 0.2, y: 5.22, w: 2.5, h: 0.46, fontSize: 26, bold: true,
                color: C.deep, fontFace: F.head, margin: 0 });
    txt(s, l, { x: x + 0.2, y: 5.7, w: 2.5, h: 0.36, fontSize: 9.5,
                color: C.muted, margin: 0 });
  });
}

// ================================================================ SLIDE 5
{
  const s = pptx.addSlide();
  chrome(s, 5, 'Feasibility and viability');
  title(s, 'Built, benchmarked, and honest about it');

  s.addChart(pptx.ChartType.bar, [
    { name: 'Best classical', labels: D.comparison.map((c) => c.label),
      values: D.comparison.map((c) => c.classical) },
    { name: 'Best quantum', labels: D.comparison.map((c) => c.label),
      values: D.comparison.map((c) => c.quantum) },
    { name: 'Hybrid', labels: D.comparison.map((c) => c.label),
      values: D.comparison.map((c) => c.hybrid) },
  ], {
    x: 0.62, y: 1.62, w: 6.6, h: 3.3,
    barDir: 'col', barGrouping: 'clustered',
    chartColors: [C.classical, C.quantum, C.hybrid],
    showTitle: true, title: 'ROC-AUC on each held-out test set',
    titleFontSize: 11, titleColor: C.body, titleFontFace: F.body,
    showValue: false, valAxisMinVal: 60, valAxisMaxVal: 100,
    catAxisLabelColor: C.muted, valAxisLabelColor: C.muted,
    catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    valGridLine: { color: C.line, size: 1 }, catGridLine: { style: 'none' },
    showLegend: true, legendPos: 'b', legendColor: C.body, legendFontSize: 9.5,
    dataBorder: { pt: 0, color: 'FFFFFF' },
  });

  txt(s, `Quantum ahead on ${D.quantum_wins} of 5 · classical ahead on 3 · reported either way`, {
    x: 0.62, y: 4.98, w: 6.6, h: 0.28, fontSize: 10, color: C.muted,
    align: 'center', margin: 0 });

  // concentration chart
  s.addChart(pptx.ChartType.line, [
    { name: 'Off-diagonal spread',
      labels: D.concentration.map((r) => `${r.qubits}q`),
      values: D.concentration.map((r) => r.off_diagonal_std) },
    { name: 'Kernel-target alignment',
      labels: D.concentration.map((r) => `${r.qubits}q`),
      values: D.concentration.map((r) => r.alignment) },
  ], {
    x: 7.42, y: 1.62, w: 5.29, h: 3.3,
    chartColors: [C.risk, C.quantum], lineSize: 3, lineSmooth: false,
    showTitle: true, title: 'Why the quantum kernel fails — measured first',
    titleFontSize: 11, titleColor: C.body, titleFontFace: F.body,
    catAxisLabelColor: C.muted, valAxisLabelColor: C.muted,
    catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    valGridLine: { color: C.line, size: 1 }, catGridLine: { style: 'none' },
    showLegend: true, legendPos: 'b', legendColor: C.body, legendFontSize: 9.5,
  });

  txt(s, 'Spread halves with every qubit added — exponential concentration, the kernel tending to the identity.', {
    x: 7.42, y: 4.98, w: 5.29, h: 0.28, fontSize: 10, color: C.muted,
    align: 'center', margin: 0 });

  // challenges answered
  const ch = [
    ['Quantum kernel underperforms', 'Diagnosed, not hidden: the platform measures concentration before training and weights the branch down automatically.'],
    ['Barren plateaus in the VQC', 'The variational models run on a narrower register than the kernel; SPSA replaces a per-parameter gradient.'],
    ['Small clinical datasets', 'Conformal coverage is reported with its calibration size, and flagged when too loose to quote.'],
  ];
  ch.forEach(([t, d], i) => {
    const x = 0.62 + i * 4.14;
    card(s, { x, y: 5.42, w: 3.9, h: 1.12, fill: C.tint });
    txt(s, t, { x: x + 0.18, y: 5.52, w: 3.55, h: 0.28, fontSize: 11, bold: true,
                color: C.ink, margin: 0 });
    txt(s, d, { x: x + 0.18, y: 5.82, w: 3.55, h: 0.64, fontSize: 9, color: C.muted,
                margin: 0 });
  });
}

// ================================================================ SLIDE 6
{
  const s = pptx.addSlide();
  chrome(s, 6, 'Research and references');
  title(s, 'What the literature says, and what we verified');

  const refs = [
    ['Havlíček et al.', 'Supervised learning with quantum-enhanced feature spaces', 'Nature 567 (2019)'],
    ['Schuld & Killoran', 'Quantum ML in feature Hilbert spaces', 'PRL 122 (2019)'],
    ['Pérez-Salinas et al.', 'Data re-uploading for a universal quantum classifier', 'Quantum 4 (2020)'],
    ['Thanasilp et al.', 'Exponential concentration in quantum kernel methods', 'Nat. Comms 15 (2024)'],
    ['Huang et al.', 'Power of data in quantum machine learning', 'Nat. Comms 12 (2021)'],
    ['Spall', 'Simultaneous perturbation stochastic approximation', 'IEEE TAC 37 (1992)'],
    ['Vovk et al.', 'Algorithmic Learning in a Random World', 'Springer (2005)'],
    ['Lundberg & Lee', 'A unified approach to interpreting model predictions', 'NeurIPS (2017)'],
  ];
  card(s, { x: 0.62, y: 1.62, w: 7.3, h: 4.3, fill: C.white });
  txt(s, 'FOUNDATIONAL RESEARCH', { x: 0.85, y: 1.8, w: 4, h: 0.26, fontSize: 9,
      color: C.deep, bold: true, charSpacing: 1.6, margin: 0 });
  refs.forEach(([a, t, v], i) => {
    const y = 2.16 + i * 0.46;
    s.addShape(pptx.ShapeType.ellipse, { x: 0.87, y: y + 0.13, w: 0.1, h: 0.1,
      fill: { color: i === 3 ? C.quantum : C.line }, line: { type: 'none' } });
    txt(s, [{ text: `${a.replace(/\.$/, '')}. `, options: { bold: true, color: C.ink } },
            { text: t, options: { color: C.body } },
            { text: `  ${v}`, options: { color: C.faint } }], {
      x: 1.1, y, w: 6.7, h: 0.4, fontSize: 10, valign: 'middle', margin: 0 });
  });
  txt(s, 'Thanasilp et al. predicts the failure mode this platform now measures on every dataset.', {
    x: 0.85, y: 6.02, w: 6.9, h: 0.26, fontSize: 9, color: C.quantum,
    italic: true, margin: 0 });

  // verified panel
  card(s, { x: 8.12, y: 1.62, w: 4.59, h: 4.3, fill: '211E4A', line: '211E4A' });
  txt(s, 'VERIFIED, NOT ASSERTED', { x: 8.35, y: 1.8, w: 4.1, h: 0.26, fontSize: 9,
      color: 'A794FF', bold: true, charSpacing: 1.6, margin: 0 });
  const checks = [
    ['1.2 × 10⁻¹⁵', 'kernel agreement with Qiskit’s own simulator, re-checked on every training run'],
    ['exact', 'gate-level agreement for the QNN circuit path'],
    ['+1.03 pts', 'accuracy removed by fixing ClinVar’s duplicate-assembly leak'],
    ['0.61 vs 0.96', 'disagreement is the weaker error signal, reported as measured'],
  ];
  checks.forEach(([v, l], i) => {
    const y = 2.2 + i * 0.85;
    txt(s, v, { x: 8.35, y, w: 4.1, h: 0.34, fontSize: 17, bold: true,
                color: C.white, fontFace: F.head, margin: 0 });
    txt(s, l, { x: 8.35, y: y + 0.34, w: 4.1, h: 0.5, fontSize: 9.5,
                color: '9B96C9', margin: 0 });
  });
  txt(s, 'Data · NCBI ClinVar · UCI · Wisconsin WDBC · NIDDK', {
    x: 8.35, y: 5.66, w: 4.1, h: 0.26, fontSize: 8.5, color: '6E6B98', margin: 0 });

  txt(s, 'A research prototype on public benchmark datasets. Not clinically validated; no output should inform a medical decision.', {
    x: 0.62, y: 6.46, w: 12.09, h: 0.3, fontSize: 9, color: C.faint,
    align: 'center', italic: true, margin: 0 });
}

pptx.writeFile({ fileName: 'QGene_SIH26139_v2.pptx' })
  .then((f) => console.log('wrote', f));
