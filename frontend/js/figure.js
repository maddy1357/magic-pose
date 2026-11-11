/*
 * Draws pose figures (from /api/poses) as SVG.
 * The body is built from thick round-capped strokes; an outline is produced
 * with two masks (grown silhouette minus silhouette), so overlapping limbs merge
 * into one clean contour — the "pose outline" shown over the camera.
 */

const WIDTH = { neck: 8, upperArm: 9, foreArm: 7.5, thigh: 13, shin: 10, torso: 6, hand: 3.6, foot: 4.6 };
let uid = 0;

const fmt = (n) => Math.round(n * 100) / 100;

function shapes(fig, grow, part = 'all') {
  const j = fig.joints;
  const k = fig.scale || 1;
  const g2 = grow * 2;
  const line = (a, b, w) =>
    `<line x1="${fmt(j[a][0])}" y1="${fmt(j[a][1])}" x2="${fmt(j[b][0])}" y2="${fmt(j[b][1])}" stroke-width="${fmt(w * k + g2)}"/>`;
  const dot = (p, r) => `<circle cx="${fmt(j[p][0])}" cy="${fmt(j[p][1])}" r="${fmt(r * k + grow)}"/>`;
  const torso = ['lShoulder', 'rShoulder', 'rHip', 'lHip'].map((n) => `${fmt(j[n][0])},${fmt(j[n][1])}`).join(' ');
  const arms = [
    line('lShoulder', 'lElbow', WIDTH.upperArm), line('lElbow', 'lWrist', WIDTH.foreArm),
    line('rShoulder', 'rElbow', WIDTH.upperArm), line('rElbow', 'rWrist', WIDTH.foreArm),
    dot('lWrist', WIDTH.hand), dot('rWrist', WIDTH.hand),
  ];
  if (part === 'arms') return arms.join('');
  return [
    `<polygon points="${torso}" stroke-width="${fmt(WIDTH.torso * k + g2)}"/>`,
    line('neck', 'head', WIDTH.neck),
    `<circle cx="${fmt(j.head[0])}" cy="${fmt(j.head[1])}" r="${fmt(fig.headR + grow)}"/>`,
    line('lHip', 'lKnee', WIDTH.thigh), line('lKnee', 'lAnkle', WIDTH.shin),
    line('rHip', 'rKnee', WIDTH.thigh), line('rKnee', 'rAnkle', WIDTH.shin),
    dot('lAnkle', WIDTH.foot), dot('rAnkle', WIDTH.foot),
    ...arms,
  ].join('');
}

/**
 * @param {object} pose  A pose from the API ({ figures, view }).
 * @param {object} [opt]
 * @param {string} [opt.color]       Outline colour.
 * @param {number} [opt.fill]        Opacity of the body fill (0..1).
 * @param {number} [opt.stroke]      Outline thickness in pose units.
 * @param {number[]} [opt.view]      Override the viewBox.
 * @param {string} [opt.className]
 * @param {boolean} [opt.dashed]     Add a dashed centre line along the outline.
 * @returns {string} SVG markup
 */
export function figureSVG(pose, opt = {}) {
  const id = `mp${++uid}`;
  const color = opt.color || '#fff';
  const fill = opt.fill ?? 0.18;
  const t = opt.stroke ?? 1.6;
  const [x, y, w, h] = opt.view || pose.view;
  const box = `x="${x - 20}" y="${y - 20}" width="${w + 40}" height="${h + 40}"`;
  const outer = pose.figures.map((f) => shapes(f, t)).join('');
  const inner = pose.figures.map((f) => shapes(f, 0)).join('');
  // Arms get their own contour too, so arms in front of the body stay readable.
  const armsOuter = pose.figures.map((f) => shapes(f, t, 'arms')).join('');
  const armsInner = pose.figures.map((f) => shapes(f, 0, 'arms')).join('');
  const style = 'stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="${opt.className || ''}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
<mask id="${id}o" maskUnits="userSpaceOnUse" ${box}>
<g fill="#fff" stroke="#fff" ${style}>${outer}</g><g fill="#000" stroke="#000" ${style}>${inner}</g>
</mask>
<mask id="${id}a" maskUnits="userSpaceOnUse" ${box}>
<g fill="#fff" stroke="#fff" ${style}>${armsOuter}</g><g fill="#000" stroke="#000" ${style}>${armsInner}</g>
</mask>
<mask id="${id}f" maskUnits="userSpaceOnUse" ${box}><g fill="#fff" stroke="#fff" ${style}>${inner}</g></mask>
</defs>
<rect ${box} fill="${color}" opacity="${fill}" mask="url(#${id}f)"/>
<rect ${box} fill="${color}" mask="url(#${id}o)"/>
<rect ${box} fill="${color}" mask="url(#${id}a)"/>
</svg>`;
}

/** Joint-pair bones used for matching and for drawing a skeleton. */
export const BONES = [
  ['pelvis', 'neck'],
  ['lShoulder', 'lElbow'], ['lElbow', 'lWrist'],
  ['rShoulder', 'rElbow'], ['rElbow', 'rWrist'],
  ['lHip', 'lKnee'], ['lKnee', 'lAnkle'],
  ['rHip', 'rKnee'], ['rKnee', 'rAnkle'],
];
