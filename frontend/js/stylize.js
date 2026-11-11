/*
 * On-device image styling.
 *  - colorMatrixFilter(): applies CSS-style colour filters (brightness, contrast,
 *    saturate, sepia, grayscale, hue-rotate, invert) with pixel maths, so it works
 *    in every browser (Safari's canvas has no ctx.filter).
 *  - applyLook(): the instant "Template" preview, shown while the AI works or
 *    when the server has no AI provider configured.
 */

// ------------------------------------------------------------ colour matrices
// A matrix is [a,b,c,o1, d,e,f,o2, g,h,i,o3] with offsets in 0..255.
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function lin3(m3, off = [0, 0, 0]) {
  return [m3[0], m3[1], m3[2], off[0], m3[3], m3[4], m3[5], off[1], m3[6], m3[7], m3[8], off[2]];
}

function matrixFor(fn, v) {
  const a = Math.max(0, Math.min(1, v));
  const r = 1 - a;
  switch (fn) {
    case 'grayscale':
      return lin3([
        0.2126 + 0.7874 * r, 0.7152 - 0.7152 * r, 0.0722 - 0.0722 * r,
        0.2126 - 0.2126 * r, 0.7152 + 0.2848 * r, 0.0722 - 0.0722 * r,
        0.2126 - 0.2126 * r, 0.7152 - 0.7152 * r, 0.0722 + 0.9278 * r,
      ]);
    case 'sepia':
      return lin3([
        0.393 + 0.607 * r, 0.769 - 0.769 * r, 0.189 - 0.189 * r,
        0.349 - 0.349 * r, 0.686 + 0.314 * r, 0.168 - 0.168 * r,
        0.272 - 0.272 * r, 0.534 - 0.534 * r, 0.131 + 0.869 * r,
      ]);
    case 'saturate': {
      const s = Math.max(0, v);
      return lin3([
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ]);
    }
    case 'hue-rotate': {
      const t = (v * Math.PI) / 180;
      const c = Math.cos(t);
      const s = Math.sin(t);
      return lin3([
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ]);
    }
    case 'brightness':
      return lin3([v, 0, 0, 0, v, 0, 0, 0, v]);
    case 'contrast': {
      const o = (0.5 - 0.5 * v) * 255;
      return lin3([v, 0, 0, 0, v, 0, 0, 0, v], [o, o, o]);
    }
    case 'invert': {
      const k = 1 - 2 * a;
      const o = a * 255;
      return lin3([k, 0, 0, 0, k, 0, 0, 0, k], [o, o, o]);
    }
    default:
      return null;
  }
}

/** m2 ∘ m1 (apply m1 first). */
function compose(m2, m1) {
  const out = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 4 + c] = m2[r * 4] * m1[c] + m2[r * 4 + 1] * m1[4 + c] + m2[r * 4 + 2] * m1[8 + c];
    }
    out[r * 4 + 3] = m2[r * 4] * m1[3] + m2[r * 4 + 1] * m1[7] + m2[r * 4 + 2] * m1[11] + m2[r * 4 + 3];
  }
  return out;
}

function parseValue(fn, raw) {
  const s = String(raw).trim();
  if (fn === 'hue-rotate') {
    const n = parseFloat(s) || 0;
    if (s.endsWith('turn')) return n * 360;
    if (s.endsWith('rad')) return (n * 180) / Math.PI;
    return n;
  }
  if (s === '') return 1;
  return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);
}

/** Parse "contrast(1.2) saturate(140%) …" into one colour matrix. */
export function parseFilter(filter) {
  let m = IDENTITY;
  if (!filter || filter === 'none') return m;
  const re = /([a-z-]+)\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(filter))) {
    const fm = matrixFor(match[1], parseValue(match[1], match[2]));
    if (fm) m = compose(fm, m);
  }
  return m;
}

/** Apply a CSS colour filter string to a canvas in place. */
export function colorMatrixFilter(canvas, filter) {
  const m = parseFilter(filter);
  if (m === IDENTITY) return canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const [a, b, c, o1, e, f, g, o2, h, i, j, o3] = m;
  for (let p = 0; p < d.length; p += 4) {
    const R = d[p];
    const G = d[p + 1];
    const B = d[p + 2];
    d[p] = a * R + b * G + c * B + o1; // Uint8ClampedArray clamps for us
    d[p + 1] = e * R + f * G + g * B + o2;
    d[p + 2] = h * R + i * G + j * B + o3;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ------------------------------------------------------------ helpers
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Copy any drawable into a canvas no larger than maxSide. */
export function toCanvas(source, maxSide = Infinity) {
  const w = source.naturalWidth || source.videoWidth || source.width;
  const h = source.naturalHeight || source.videoHeight || source.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = makeCanvas(w * k, h * k);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/** Cheap blur: shrink then enlarge with smoothing. */
function blurredCopy(canvas, factor) {
  const small = makeCanvas(canvas.width / factor, canvas.height / factor);
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const out = makeCanvas(canvas.width, canvas.height);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

const lum = (d, p) => 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];

/** Flatten colours into `levels` bands, optionally with ink outlines (cartoon look). */
function posterize(canvas, levels, inkEdges) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const soft = blurredCopy(canvas, 2);
  const img = soft.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const blur = inkEdges ? blurredCopy(canvas, 5).getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data : null;
  const orig = inkEdges ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : null;
  const step = 255 / (levels - 1);
  for (let p = 0; p < d.length; p += 4) {
    let k = 1;
    if (inkEdges) {
      const diff = lum(blur, p) - lum(orig, p);
      if (diff > 14) k = Math.max(0.12, 1 - (diff - 14) / 36);
    }
    d[p] = Math.round(d[p] / step) * step * k;
    d[p + 1] = Math.round(d[p + 1] / step) * step * k;
    d[p + 2] = Math.round(d[p + 2] / step) * step * k;
  }
  ctx.putImageData(img, 0, 0);
}

/** Pencil-sketch: grey image colour-dodged with its blurred negative. */
function sketch(canvas) {
  colorMatrixFilter(canvas, 'grayscale(1)');
  const neg = makeCanvas(canvas.width, canvas.height);
  neg.getContext('2d').drawImage(canvas, 0, 0);
  colorMatrixFilter(neg, 'invert(1)');
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'color-dodge';
  ctx.drawImage(blurredCopy(neg, 6), 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(canvas, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function glow(canvas, amount) {
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = amount;
  ctx.drawImage(blurredCopy(canvas, 12), 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function tint(canvas, { colors, blend = 'soft-light', alpha = 0.5 }) {
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, canvas.width * 0.3, canvas.height);
  colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function vignette(canvas, strength) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

let noiseTile = null;
function grain(canvas, amount) {
  if (!noiseTile) {
    noiseTile = makeCanvas(160, 160);
    const nctx = noiseTile.getContext('2d');
    const img = nctx.createImageData(160, 160);
    for (let p = 0; p < img.data.length; p += 4) {
      const v = Math.random() * 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(1, amount * 1.6);
  ctx.fillStyle = ctx.createPattern(noiseTile, 'repeat');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Render a template's look onto a copy of `source`.
 * @param {CanvasImageSource} source
 * @param {object} look  Template look recipe (see backend/src/data/templates.js)
 * @param {number} [maxSide]
 * @returns {HTMLCanvasElement}
 */
export function applyLook(source, look, maxSide = 1600) {
  const c = toCanvas(source, maxSide);
  if (!look) return c;
  if (look.effect === 'posterize') posterize(c, 6, true);
  else if (look.effect === 'paint') {
    const soft = blurredCopy(c, 3);
    c.getContext('2d').drawImage(soft, 0, 0);
    posterize(c, 9, false);
  } else if (look.effect === 'sketch') sketch(c);
  if (look.filter) colorMatrixFilter(c, look.filter);
  if (look.tint) tint(c, look.tint);
  if (look.effect === 'glow') glow(c, 0.38);
  if (look.vignette) vignette(c, look.vignette);
  if (look.grain) grain(c, look.grain);
  return c;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality);
  });
}

/** Photo filters offered on the camera (live preview uses the same string as CSS). */
export const FILTERS = [
  { id: 'normal', name: 'Normal', css: '' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.45) contrast(1.1)' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.22) saturate(1.3) hue-rotate(-8deg)' },
  { id: 'cool', name: 'Cool', css: 'saturate(1.1) hue-rotate(12deg) brightness(1.03)' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.15)' },
  { id: 'fade', name: 'Fade', css: 'contrast(0.85) brightness(1.1) saturate(0.8)' },
  { id: 'drama', name: 'Drama', css: 'contrast(1.4) saturate(0.9) brightness(0.92)' },
];
