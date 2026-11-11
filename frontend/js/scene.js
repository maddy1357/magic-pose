/*
 * Scene analyser for "Auto pose": looks at the camera background and counts
 * the people in the frame, then suggests poses and templates that suit it.
 *
 *  - An image classifier (EfficientNet-Lite0, ImageNet labels) recognises
 *    things like a seashore, an alp, a park bench, a streetcar or a palace.
 *  - Simple colour checks catch night shots, open sky and greenery when the
 *    classifier is unsure.
 *  - A pose detector counts people, so couples and groups get matching poses.
 * Runs on the device; frames never leave the browser.
 */
import { loadVision, createTask, MODELS } from './vision.js';

export const SCENES = [
  {
    id: 'beach', name: 'Beach', emoji: '🏖️',
    labels: ['seashore', 'sandbar', 'coral reef', 'breakwater', 'swimming trunks', 'bikini', 'snorkel', 'sarong'],
    poses: ['hair-touch', 'victory', 'star-jump', 'cross-legged', 'the-wave'],
    templates: ['golden-hour', 'sunset-couple'],
  },
  {
    id: 'water', name: 'Waterside', emoji: '🌊',
    labels: ['lakeside', 'boathouse', 'dock', 'pier', 'canoe', 'speedboat', 'paddle', 'lifeboat', 'catamaran', 'gondola', 'liner', 'fireboat', 'yawl', 'schooner'],
    poses: ['the-wave', 'hair-touch', 'relaxed-pockets', 'one-knee-up'],
    templates: ['golden-hour', 'retro-film'],
  },
  {
    id: 'mountain', name: 'Mountains', emoji: '🏔️',
    labels: ['alp', 'valley', 'cliff', 'volcano', 'promontory', 'geyser', 'mountain tent', 'mountain bike'],
    poses: ['victory', 'sky-point', 'power-stance', 'one-knee-up'],
    templates: ['superhero', 'golden-hour'],
  },
  {
    id: 'snow', name: 'Snow', emoji: '❄️',
    labels: ['ski', 'snowmobile', 'dogsled', 'snowplow', 'bobsled', 'ski mask', 'shovel'],
    poses: ['the-wave', 'victory', 'star-jump'],
    templates: ['winter-wonder'],
  },
  {
    id: 'nature', name: 'Nature', emoji: '🌿',
    labels: ['daisy', 'hay', 'rapeseed', 'maze', 'greenhouse', 'lawn mower', 'pot', 'corn', 'acorn', 'buckeye', 'hip', 'cardoon', 'yellow lady\'s slipper'],
    poses: ['tree-pose', 'cross-legged', 'hair-touch', 'warrior-two', 'relaxed-pockets'],
    templates: ['watercolor', 'golden-hour'],
  },
  {
    id: 'landmark', name: 'Landmark', emoji: '🏛️',
    labels: ['palace', 'castle', 'church', 'mosque', 'monastery', 'triumphal arch', 'obelisk', 'dome', 'bell cote', 'stupa', 'fountain', 'suspension bridge', 'steel arch bridge', 'planetarium', 'megalith', 'totem pole', 'beacon', 'altar', 'cinema'],
    poses: ['sky-point', 'victory', 'the-wave', 'hands-on-hips'],
    templates: ['royal-portrait', 'superhero'],
  },
  {
    id: 'city', name: 'City street', emoji: '🏙️',
    labels: ['streetcar', 'cab', 'traffic light', 'street sign', 'parking meter', 'trolleybus', 'minibus', 'moped', 'motor scooter', 'police van', 'sports car', 'convertible', 'limousine', 'school bus', 'fire engine', 'garbage truck', 'mailbox', 'pay-phone', 'barbershop', 'bakery', 'bookshop', 'butcher shop', 'confectionery', 'shoe shop', 'tobacco shop', 'toyshop', 'grocery store', 'tram'],
    poses: ['runway-walk', 'leaning-cross', 'jacket-shoulder', 'sunglasses', 'editorial-hip'],
    templates: ['neon-nights', 'retro-film', 'cover-star'],
  },
  {
    id: 'wall', name: 'Wall or door', emoji: '🧱',
    labels: ['sliding door', 'shoji', 'stone wall', 'picket fence', 'worm fence', 'chain-link fence', 'window screen', 'prison', 'doormat', 'garage'],
    poses: ['leaning-cross', 'editorial-hip', 'arms-crossed', 'relaxed-pockets'],
    templates: ['retro-film', 'cover-star'],
  },
  {
    id: 'seat', name: 'Sofa or seat', emoji: '🛋️',
    labels: ['studio couch', 'park bench', 'folding chair', 'rocking chair', 'barber chair', 'throne', 'four-poster', 'quilt', 'pillow', 'cradle', 'chiffonier'],
    poses: ['chair-relaxed', 'seated-chin', 'one-knee-up', 'steps-casual'],
    templates: ['royal-portrait', 'studio-editorial'],
  },
  {
    id: 'gym', name: 'Gym or sport', emoji: '🏋️',
    labels: ['dumbbell', 'barbell', 'horizontal bar', 'parallel bars', 'balance beam', 'punching bag', 'basketball', 'volleyball', 'rugby ball', 'soccer ball', 'tennis ball', 'racket', 'ballplayer', 'football helmet', 'running shoe'],
    poses: ['double-flex', 'warrior-two', 'goddess-squat', 'tree-pose', 'air-kick'],
    templates: ['superhero'],
  },
  {
    id: 'party', name: 'Stage or party', emoji: '🎉',
    labels: ['stage', 'theater curtain', 'spotlight', 'microphone', 'electric guitar', 'acoustic guitar', 'drum', 'grand piano', 'balloon', 'jack-o\'-lantern', 'loudspeaker'],
    poses: ['dab', 'victory', 'peace-selfie', 'double-flex'],
    templates: ['neon-nights', 'anime'],
  },
  {
    id: 'indoor', name: 'Indoors', emoji: '🏠',
    labels: ['desk', 'monitor', 'desktop computer', 'notebook', 'laptop', 'library', 'bookcase', 'home theater', 'entertainment center', 'wardrobe', 'dining table', 'restaurant', 'window shade', 'lampshade', 'table lamp', 'refrigerator', 'microwave', 'china cabinet', 'washbasin', 'bathtub', 'shower curtain', 'medicine chest', 'television', 'screen', 'file', 'printer', 'mouse', 'computer keyboard', 'space bar', 'web site', 'wall clock', 'bannister', 'radiator', 'switch'],
    poses: ['thinker', 'arms-crossed', 'heart-hands', 'classic-selfie', 'sunglasses'],
    templates: ['studio-editorial', 'pencil-sketch', 'cartoon-3d', 'watercolor'],
  },
  // Colour-based scenes (used when the classifier has no confident answer)
  {
    id: 'night', name: 'Night', emoji: '🌙', labels: [],
    poses: ['sunglasses', 'leaning-cross', 'power-stance'],
    templates: ['neon-nights', 'space-walk'],
  },
  {
    id: 'sky', name: 'Open sky', emoji: '☀️', labels: [],
    poses: ['victory', 'the-wave', 'hands-on-hips', 'sky-point'],
    templates: ['golden-hour', 'superhero'],
  },
];

const byLabel = new Map();
for (const s of SCENES) for (const l of s.labels) byLabel.set(l, s);
const byId = new Map(SCENES.map((s) => [s.id, s]));

const MIN_SCENE_SCORE = 0.08;

export class SceneAnalyzer {
  constructor() {
    this.classifier = null;
    this.people = null;
    this.loading = null;
    this.canvas = document.createElement('canvas');
    this.small = document.createElement('canvas');
  }

  get ready() {
    return Boolean(this.classifier);
  }

  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const { vision, files } = await loadVision();
      const [classifier, people] = await Promise.all([
        createTask((o) => vision.ImageClassifier.createFromOptions(files, o), {
          baseOptions: { modelAssetPath: MODELS.classifier },
          runningMode: 'IMAGE',
          maxResults: 20,
          scoreThreshold: 0.01,
        }),
        createTask((o) => vision.PoseLandmarker.createFromOptions(files, o), {
          baseOptions: { modelAssetPath: MODELS.pose },
          runningMode: 'IMAGE',
          numPoses: 4,
          minPoseDetectionConfidence: 0.5,
        }),
      ]);
      this.classifier = classifier;
      this.people = people;
      return this;
    })();
    this.loading.catch(() => { this.loading = null; });
    return this.loading;
  }

  /**
   * @param {HTMLVideoElement} video
   * @returns {{scene: object|null, people: number, labels: string[]}}
   */
  analyze(video) {
    if (!this.ready || !video.videoWidth) return { scene: null, people: 0, labels: [] };
    // Downscale once; models resize internally anyway.
    const k = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
    const c = this.canvas;
    c.width = Math.round(video.videoWidth * k);
    c.height = Math.round(video.videoHeight * k);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);

    const result = this.classifier.classify(c);
    const cats = (result && result.classifications && result.classifications[0] && result.classifications[0].categories) || [];
    const totals = new Map();
    for (const cat of cats) {
      const name = String(cat.categoryName || cat.displayName || '').toLowerCase();
      const scene = byLabel.get(name);
      if (scene) totals.set(scene, (totals.get(scene) || 0) + cat.score);
    }
    let scene = null;
    let best = 0;
    for (const [s, score] of totals) {
      if (score > best) { best = score; scene = s; }
    }
    if (best < MIN_SCENE_SCORE) scene = this.colourScene(c);

    let people = 0;
    try {
      const pose = this.people.detect(c);
      people = (pose && pose.landmarks && pose.landmarks.length) || 0;
    } catch { /* ignore */ }

    return { scene, people, labels: cats.slice(0, 3).map((x) => x.categoryName) };
  }

  /** Night, open sky or greenery from simple colour statistics. */
  colourScene(src) {
    const s = this.small;
    s.width = 48;
    s.height = 36;
    const ctx = s.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, s.width, s.height);
    const d = ctx.getImageData(0, 0, s.width, s.height).data;
    let lum = 0;
    let sky = 0;
    let skyN = 0;
    let green = 0;
    const n = d.length / 4;
    for (let p = 0, i = 0; p < d.length; p += 4, i++) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      lum += l;
      if (g > r + 12 && g > b + 8) green++;
      if (i < (s.width * s.height) / 3) {
        skyN++;
        if (b > r + 15 && b >= g - 5 && l > 0.42) sky++;
      }
    }
    lum /= n;
    if (lum < 0.18) return byId.get('night');
    if (sky / skyN > 0.35) return byId.get('sky');
    if (green / n > 0.3) return byId.get('nature');
    return null;
  }
}

/** Bucket people so 0 and 1 count as "solo". */
export function peopleBucket(n) {
  return n >= 3 ? 'group' : n === 2 ? 'couple' : 'solo';
}

/**
 * Suggested pose or template ids for an analysis result.
 * @param {{scene: object|null, people: number}} r
 * @param {'pose'|'template'} kind
 * @param {{poses: object[], templateIds: Set<string>}} catalog
 */
export function suggestionsFor(r, kind, catalog) {
  const bucket = peopleBucket(r.people);
  if (kind === 'pose') {
    if (bucket !== 'solo') {
      const cat = bucket === 'couple' ? 'couple' : 'group';
      const list = catalog.poses.filter((p) => p.category === cat).map((p) => p.id);
      // Outdoors, raised arms look great: put those first.
      if (r.scene && ['beach', 'mountain', 'sky', 'landmark'].includes(r.scene.id)) {
        return [...list.filter((id) => /reach|jump/.test(id)), ...list.filter((id) => !/reach|jump/.test(id))];
      }
      return list;
    }
    const ids = new Set(catalog.poses.map((p) => p.id));
    return r.scene ? r.scene.poses.filter((id) => ids.has(id)) : [];
  }
  if (bucket === 'couple' && catalog.templateIds.has('sunset-couple')) {
    return ['sunset-couple', ...(r.scene ? r.scene.templates.filter((id) => id !== 'sunset-couple') : [])];
  }
  return r.scene ? r.scene.templates.filter((id) => catalog.templateIds.has(id) && id !== 'sunset-couple') : [];
}
