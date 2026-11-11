/*
 * Pose coach: detects the person in the camera with MediaPipe Pose Landmarker
 * (runs fully on the device) and scores how well they match the Idea outline.
 * The library and model are only downloaded when the coach is switched on.
 */
import { BONES } from './figure.js';

const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// MediaPipe landmark indices: [left-side, right-side] of the person's body
const MP = {
  shoulder: [11, 12],
  elbow: [13, 14],
  wrist: [15, 16],
  hip: [23, 24],
  knee: [25, 26],
  ankle: [27, 28],
};
const MIN_VIS = 0.5;
const LEG_BONES = new Set(['lHip>lKnee', 'lKnee>lAnkle', 'rHip>rKnee', 'rKnee>rAnkle']);

export class PoseCoach {
  constructor() {
    this.landmarker = null;
    this.loading = null;
    this.lastTs = -1;
  }

  get ready() {
    return Boolean(this.landmarker);
  }

  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const vision = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const make = (delegate) =>
        vision.PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      try {
        this.landmarker = await make('GPU');
      } catch {
        this.landmarker = await make('CPU');
      }
      return this;
    })();
    this.loading.catch(() => { this.loading = null; });
    return this.loading;
  }

  /** @returns {Array<{x:number,y:number,visibility:number}>|null} */
  detect(video) {
    if (!this.landmarker || !video.videoWidth) return null;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const res = this.landmarker.detectForVideo(video, ts);
    return (res && res.landmarks && res.landmarks[0]) || null;
  }
}

/**
 * Convert MediaPipe landmarks (normalised to the raw video frame) into the
 * same joint names the pose library uses, in on-screen pixel coordinates.
 * "l" is whichever side appears on the left of the screen.
 */
export function landmarksToJoints(lm, { videoW, videoH, frameW, frameH, zoom = 1, mirrored = false }) {
  const s = Math.max(frameW / videoW, frameH / videoH);
  const dx = (frameW - videoW * s) / 2;
  const dy = (frameH - videoH * s) / 2;
  const cx = frameW / 2;
  const cy = frameH / 2;
  const toScreen = (p) => {
    let x = p.x * videoW * s + dx;
    let y = p.y * videoH * s + dy;
    x = cx + (x - cx) * zoom * (mirrored ? -1 : 1);
    y = cy + (y - cy) * zoom;
    return { x, y, v: p.visibility ?? 1 };
  };
  const pts = {};
  for (const [name, [a, b]] of Object.entries(MP)) pts[name] = [toScreen(lm[a]), toScreen(lm[b])];
  // Which of the person's sides is on the left of the screen?
  const flip = pts.shoulder[0].x > pts.shoulder[1].x ? 1 : 0;
  const side = (name, screenLeft) => pts[name][screenLeft ? flip : 1 - flip];
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) });
  const j = {
    lShoulder: side('shoulder', true), rShoulder: side('shoulder', false),
    lElbow: side('elbow', true), rElbow: side('elbow', false),
    lWrist: side('wrist', true), rWrist: side('wrist', false),
    lHip: side('hip', true), rHip: side('hip', false),
    lKnee: side('knee', true), rKnee: side('knee', false),
    lAnkle: side('ankle', true), rAnkle: side('ankle', false),
  };
  j.neck = mid(j.lShoulder, j.rShoulder);
  j.pelvis = mid(j.lHip, j.rHip);
  return j;
}

const angle = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);

/**
 * Compare bone directions of the target figure and the detected person.
 * @returns {{score: number|null, seen: number}} score 0..1, null if too little is visible
 */
export function matchScore(figure, joints, framing = 'full') {
  let total = 0;
  let weights = 0;
  let seen = 0;
  for (const [a, b] of BONES) {
    if (framing === 'half' && LEG_BONES.has(`${a}>${b}`)) continue;
    const pa = joints[a];
    const pb = joints[b];
    if (!pa || !pb || pa.v < MIN_VIS || pb.v < MIN_VIS) continue;
    const t = angle(figure.joints[a], figure.joints[b]);
    const d = angle([pa.x, pa.y], [pb.x, pb.y]);
    let diff = Math.abs(t - d) * (180 / Math.PI);
    if (diff > 180) diff = 360 - diff;
    const w = a === 'pelvis' ? 1.5 : LEG_BONES.has(`${a}>${b}`) ? 0.8 : 1;
    total += w * Math.max(0, 1 - diff / 55);
    weights += w;
    seen++;
  }
  if (seen < 4) return { score: null, seen };
  return { score: total / weights, seen };
}

/** Draw the detected skeleton on a canvas that covers the frame. */
export function drawSkeleton(canvas, joints, color) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!joints) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;
  const bones = [...BONES, ['lShoulder', 'rShoulder'], ['lHip', 'rHip']];
  for (const [a, b] of bones) {
    const pa = joints[a];
    const pb = joints[b];
    if (!pa || !pb || pa.v < MIN_VIS || pb.v < MIN_VIS) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  for (const p of Object.values(joints)) {
    if (p.v < MIN_VIS) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function clearSkeleton(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
