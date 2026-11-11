/*
 * Magic Pose — main app.
 * Modes: Explore (pose library), Idea (pose outline on the camera),
 * Photo (plain camera) and Template (pose outline + instant AI restyle).
 * Auto pose: in Idea and Template, the pose / style follows the background.
 */
import { api } from './api.js';
import { Camera, describeCameraError } from './camera.js';
import { PoseCoach, landmarksToJoints, matchScore, drawSkeleton, clearSkeleton } from './coach.js';
import { figureSVG } from './figure.js';
import { addPhoto, updatePhoto, listPhotos, latestPhoto, deletePhoto, clearPhotos, usage } from './gallery.js';
import { SceneAnalyzer, suggestionsFor, peopleBucket } from './scene.js';
import { loadSettings, saveSettings } from './settings.js';
import { applyLook, canvasToBlob, toCanvas, FILTERS } from './stylize.js';

// ------------------------------------------------------------------ helpers
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;

const app = $('app');
const frame = $('frame');
const video = $('video');
const overlay = $('overlay');
const shutter = $('shutter');

const settings = loadSettings();
const camera = new Camera(video);
const coach = new PoseCoach();
const scene = new SceneAnalyzer();

const CATEGORY_COLORS = {
  standing: ['#3a3577', '#17162a'],
  fashion: ['#6b2e5f', '#1d1220'],
  sitting: ['#2d5560', '#121c20'],
  selfie: ['#6a4a2a', '#1f1710'],
  fun: ['#2f5d3a', '#111d14'],
  fitness: ['#245a6b', '#0f1a1f'],
  couple: ['#6b2f3d', '#201014'],
  group: ['#4a3f78', '#17142a'],
};
const OUTLINE_COLORS = [
  ['#ffffff', 'White'], ['#ffd400', 'Yellow'], ['#3ef0ff', 'Cyan'], ['#ff5ca8', 'Pink'], ['#3ddc97', 'Green'],
];

const state = {
  mode: 'photo',
  poses: [],
  poseMap: new Map(),
  categories: [],
  templates: [],
  templateMap: new Map(),
  ai: { enabled: false, provider: 'none' },
  exploreCat: 'all',
  exploreQuery: '',
  detailPoseId: null,
  busy: false,
  countdown: null,
  sheets: [],
  viewer: null,
  thumbUrl: null,
  galleryUrls: [],
  suggested: [], // ids suggested by Auto pose for the current mode
};

// ------------------------------------------------------------------ toast
let toastTimer;
function toast(msg, ms = 2400) {
  const el = $('toast');
  el.textContent = msg;
  // Show it near the bottom of the camera frame, clear of the info pill.
  const r = frame.getBoundingClientRect();
  if (r.height > 0 && $('viewer').hidden) {
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${Math.max(70, r.bottom - 104)}px`;
  } else {
    el.style.left = '50%';
    el.style.top = '80px';
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ sound
let audioCtx = null;
function audio() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq = 880, dur = 0.08, gain = 0.08) {
  if (!settings.sound) return;
  try {
    const ctx = audio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio not available */ }
}
function shutterSound() {
  if (!settings.sound) return;
  try {
    const ctx = audio();
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.buffer = buf;
    src.connect(g).connect(ctx.destination);
    src.start();
  } catch { /* audio not available */ }
}

// ------------------------------------------------------------------ settings → UI
const RATIOS = { '3:4': 3 / 4, '9:16': 9 / 16, '1:1': 1, full: null };
const TIMERS = ['0', '3', '10'];

function persist() {
  saveSettings(settings);
}

function currentFilter() {
  return FILTERS.find((f) => f.id === settings.filter) || FILTERS[0];
}

function applyVisualSettings() {
  app.dataset.grid = settings.grid ? 'on' : 'off';
  $('gridBtn').classList.toggle('on', settings.grid);
  app.style.setProperty('--overlay-opacity', String(settings.overlayOpacity));
  app.style.setProperty('--overlay-size', String(settings.overlaySize));

  const flashOn = settings.flash === 'on';
  $('flashBtn').classList.toggle('on', flashOn);
  $('flashBtn').innerHTML = icon(flashOn ? 'flash' : 'flash-off');
  $('flashBtn').setAttribute('aria-label', flashOn ? 'Flash on' : 'Flash off');

  const t = $('timerLabel');
  t.hidden = settings.timer === '0';
  t.textContent = `${settings.timer}s`;
  $('timerBtn').setAttribute('aria-label', settings.timer === '0' ? 'Self-timer off' : `Self-timer ${settings.timer} seconds`);

  const f = currentFilter();
  $('filterLabel').hidden = f.id === 'normal';
  $('filterLabel').textContent = f.name;
  $('filterBtn').setAttribute('aria-label', `Filter: ${f.name}`);
  video.style.filter = f.css || '';

  const r = RATIOS[settings.ratio];
  app.dataset.ratio = settings.ratio === 'full' ? 'full' : 'fixed';
  if (r) app.style.setProperty('--ratio', String(r));
  $('ratioLabel').textContent = settings.ratio === 'full' ? 'Full' : settings.ratio;

  $('autoBtn').setAttribute('aria-pressed', String(settings.autoPose));
  $('jpegOut').textContent = `${Math.round(settings.jpeg * 100)}%`;
  $('opacityOut').textContent = `${Math.round(settings.overlayOpacity * 100)}%`;
  $('sizeOut').textContent = `${Math.round(settings.overlaySize * 100)}%`;
  $('thresholdOut').textContent = `${Math.round(settings.threshold * 100)}%`;
}

function fillSettingsForm() {
  for (const el of $('settingsForm').querySelectorAll('[name]')) {
    const v = settings[el.name];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = String(v);
  }
  $('colorSwatches').innerHTML = OUTLINE_COLORS.map(
    ([c, name]) => `<button class="swatch" type="button" role="radio" data-color="${c}" aria-label="${name}" aria-checked="${c === settings.overlayColor}" style="background:${c}"></button>`
  ).join('');
}

function onSettingChange(e) {
  const el = e.target;
  if (!el.name || !(el.name in settings)) return;
  const prev = settings[el.name];
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'range') v = Number(el.value);
  else v = el.value;
  settings[el.name] = v;
  persist();
  applyVisualSettings();
  if (el.name === 'resolution' && e.type === 'change' && prev !== v) startCamera();
  if (el.name === 'coach' || el.name === 'autoCapture') {
    updateCoach();
    if (el.name === 'coach' && v && e.type === 'change') toast('Pose coach on: it runs on this device');
  }
}

// ------------------------------------------------------------------ camera
async function startCamera() {
  stopCoach();
  $('camMsg').hidden = true;
  if (!Camera.supported()) {
    showCamError({ name: 'NotFoundError' });
    return;
  }
  try {
    await camera.start({ facing: settings.facing, resolution: Number(settings.resolution) });
    app.style.setProperty('--flip', camera.isFront ? '-1' : '1');
    $('flipBtn').style.visibility = camera.deviceCount < 2 ? 'hidden' : 'visible';
    renderZoom();
    updateCoach();
    updateAuto();
  } catch (err) {
    showCamError(err);
  }
}

function showCamError(err) {
  const info = describeCameraError(err);
  $('camMsgTitle').textContent = info.title;
  $('camMsgText').textContent = info.text;
  $('camMsg').hidden = false;
  $('zoom').innerHTML = '';
  $('flipBtn').style.visibility = 'hidden';
}

function renderZoom() {
  const el = $('zoom');
  const stops = camera.active ? camera.zoomStops() : [];
  if (stops.length < 2) {
    el.innerHTML = '';
    return;
  }
  const current = camera.zoom;
  el.innerHTML = stops
    .map((z) => `<button type="button" data-zoom="${z}" class="${Math.abs(z - current) < 0.01 ? 'on' : ''}">${z < 1 ? '.5' : z}×</button>`)
    .join('');
}

async function setZoom(z) {
  const digital = await camera.setZoom(z);
  app.style.setProperty('--zoom', String(digital));
  renderZoom();
}

async function flipCamera() {
  settings.facing = settings.facing === 'user' ? 'environment' : 'user';
  persist();
  app.style.setProperty('--zoom', '1');
  await startCamera();
}

// ------------------------------------------------------------------ modes
const MODE_ORDER = ['explore', 'idea', 'photo', 'template'];

function highlightTab(mode) {
  for (const b of $('modes').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
}

function setMode(mode) {
  if (mode === 'explore') {
    openExplore();
    return;
  }
  const changed = state.mode !== mode;
  state.mode = mode;
  app.dataset.mode = mode;
  highlightTab(mode);
  if (changed) {
    auto.applied = null;
    auto.lock = null;
    state.suggested = auto.last ? suggestionsForMode(auto.last) : [];
  }
  renderStrip();
  renderOverlay();
  updateHint();
  updateCoach();
  updateAuto();
}

function currentPose() {
  if (state.mode === 'idea') return state.poseMap.get(settings.ideaPoseId) || state.poses[0];
  if (state.mode === 'template') {
    const t = currentTemplate();
    return t && state.poseMap.get(t.poseId);
  }
  return null;
}

function currentTemplate() {
  return state.templateMap.get(settings.templateId) || state.templates[0];
}

function renderOverlay() {
  const pose = currentPose();
  overlay.innerHTML = pose ? figureSVG(pose, { color: settings.overlayColor, fill: 0.12, stroke: 1.3 }) : '';
}

/** The pill at the top of the camera: what you're shooting + coach score. */
function updateHint() {
  const hint = $('hint');
  const btn = $('hintBtn');
  if (state.mode === 'idea') {
    const p = currentPose();
    if (!p) { hint.hidden = true; return; }
    $('hintTitle').textContent = p.name;
    btn.textContent = 'Change';
    btn.hidden = false;
  } else if (state.mode === 'template') {
    const t = currentTemplate();
    if (!t) { hint.hidden = true; return; }
    $('hintTitle').textContent = `${t.emoji} ${t.name}`;
    btn.hidden = true;
  } else {
    hint.hidden = true;
    return;
  }
  hint.hidden = false;
  if (!coachRunning || $('coach').hidden) $('hintSub').textContent = defaultHintSub();
}

function defaultHintSub() {
  const autoNote = settings.autoPose && auto.last && auto.last.scene ? ` · Auto: ${auto.last.scene.name}` : '';
  if (state.mode === 'idea') return `Line yourself up with the outline${autoNote}`;
  return `${state.ai.enabled ? 'Take the shot and AI restyles it' : 'Take the shot for an instant restyle'}${autoNote}`;
}

// ------------------------------------------------------------------ picker strip
function poseTile(p, selectedId, suggested) {
  const fav = settings.favorites.includes(p.id);
  const badge = suggested ? '<span class="badge ai">AUTO</span>' : fav ? '<span class="badge">❤️</span>' : '';
  return `<button class="strip-item" role="option" type="button" data-pose="${esc(p.id)}" aria-selected="${p.id === selectedId}" title="${esc(p.name)}">
    <span class="tile" style="background:radial-gradient(circle at 50% 30%,${(CATEGORY_COLORS[p.category] || [])[0] || '#2c2a4a'},#14141c 80%)">${figureSVG(p, { color: '#fff', fill: 0.22, stroke: 2.2 })}${badge}</span><small>${esc(p.name)}</small></button>`;
}

function templateTile(t, selectedId, suggested = false) {
  const pose = state.poseMap.get(t.poseId);
  return `<button class="strip-item" role="option" type="button" data-template="${esc(t.id)}" aria-selected="${t.id === selectedId}" title="${esc(t.name)}">
    <span class="tile" style="background:linear-gradient(150deg,${t.swatch.join(',')})">${pose ? figureSVG(pose, { color: '#fff', fill: 0.3, stroke: 2.2 }) : ''}<span class="badge${suggested ? ' ai' : ''}">${suggested ? 'AUTO' : t.emoji}</span></span>
    <small>${esc(t.name)}</small></button>`;
}

function renderStrip() {
  const wrap = $('stripWrap');
  const strip = $('strip');
  const help = $('dockHelp');
  const suggested = new Set(state.suggested);
  if (state.mode === 'idea' && state.poses.length) {
    $('pickerTitle').textContent = 'Pick a pose';
    $('pickerMore').hidden = false;
    const favs = new Set(settings.favorites);
    const rank = (p) => (suggested.has(p.id) ? 0 : favs.has(p.id) ? 1 : 2);
    const ordered = [...state.poses].sort((a, b) => rank(a) - rank(b));
    strip.innerHTML =
      ordered.map((p) => poseTile(p, settings.ideaPoseId, suggested.has(p.id))).join('') +
      `<button class="strip-item more" type="button" data-more><span class="tile">${icon('compass')}</span><small>Explore all</small></button>`;
  } else if (state.mode === 'template' && state.templates.length) {
    $('pickerTitle').textContent = 'Pick a style';
    $('pickerMore').hidden = true;
    const ordered = [...state.templates].sort((a, b) => (suggested.has(a.id) ? 0 : 1) - (suggested.has(b.id) ? 0 : 1));
    strip.innerHTML = ordered.map((t) => templateTile(t, settings.templateId, suggested.has(t.id))).join('');
  } else {
    wrap.hidden = true;
    help.hidden = false;
    return;
  }
  wrap.hidden = false;
  help.hidden = true;
  renderSceneLine();
  const sel = strip.querySelector('[aria-selected="true"]');
  if (sel) requestAnimationFrame(() => sel.scrollIntoView({ inline: 'center', block: 'nearest' }));
}

function selectInStrip(item) {
  for (const el of $('strip').querySelectorAll('.strip-item')) el.setAttribute('aria-selected', String(el === item));
  if (item) item.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

function onStripClick(e) {
  const item = e.target.closest('.strip-item');
  if (!item) return;
  if (item.hasAttribute('data-more')) {
    openExplore();
    return;
  }
  if (item.dataset.pose) settings.ideaPoseId = item.dataset.pose;
  if (item.dataset.template) settings.templateId = item.dataset.template;
  persist();
  auto.lock = auto.applied; // a manual pick wins until the scene changes
  selectInStrip(item);
  renderOverlay();
  updateHint();
  updateCoach();
}

// ------------------------------------------------------------------ auto pose (follows the background)
const auto = {
  timer: null,
  busy: false,
  last: null, // last analysis {scene, people}
  pendingKey: null,
  applied: null, // key of the scene the current pick was made for
  lock: null, // key the user overrode manually
  failed: false,
};
const sceneKey = (r) => `${r.scene ? r.scene.id : 'none'}:${peopleBucket(r.people)}`;

function suggestionsForMode(r) {
  return suggestionsFor(r, state.mode === 'template' ? 'template' : 'pose', {
    poses: state.poses,
    templateIds: new Set(state.templates.map((t) => t.id)),
  });
}

function updateAuto() {
  const on = settings.autoPose && (state.mode === 'idea' || state.mode === 'template') && camera.active && !state.viewer && !auto.failed;
  if (!on) {
    clearInterval(auto.timer);
    auto.timer = null;
    renderSceneLine();
    return;
  }
  if (!auto.timer) {
    auto.timer = setInterval(autoTick, 2000);
    autoTick();
  }
  renderSceneLine();
}

function renderSceneLine() {
  const el = $('sceneLine');
  const active = settings.autoPose && (state.mode === 'idea' || state.mode === 'template');
  if (!active) { el.hidden = true; return; }
  el.hidden = false;
  if (auto.failed) el.textContent = 'Auto pose is unavailable (needs internet the first time)';
  else if (!scene.ready) el.textContent = 'Getting ready to read your background…';
  else if (!auto.last) el.textContent = 'Looking at your background…';
  else {
    const r = auto.last;
    const who = r.people >= 3 ? `${r.people} people` : r.people === 2 ? '2 people' : r.people === 1 ? '1 person' : 'no one yet';
    el.textContent = r.scene
      ? `${r.scene.emoji} ${r.scene.name} · ${who}: ${state.mode === 'template' ? 'styles' : 'poses'} picked for you`
      : `🔎 Background not recognised · ${who}`;
  }
}

async function autoTick() {
  if (auto.busy || document.hidden || !camera.active) return;
  auto.busy = true;
  try {
    if (!scene.ready) {
      renderSceneLine();
      await scene.load();
    }
    const r = scene.analyze(video);
    auto.last = r;
    const key = sceneKey(r);
    // Need the same reading twice in a row before acting, so it doesn't flicker.
    if (key === auto.pendingKey && key !== auto.applied) applyAuto(r, key);
    auto.pendingKey = key;
    renderSceneLine();
    if (!coachRunning) updateHint();
  } catch (err) {
    auto.failed = true;
    clearInterval(auto.timer);
    auto.timer = null;
    renderSceneLine();
  } finally {
    auto.busy = false;
  }
}

function applyAuto(r, key) {
  if (state.busy || state.countdown || state.viewer || !state.sheets.every((s) => s.hidden)) return;
  if (coachRunning && smoothScore > 0.55) return; // they're mid-pose: don't move the target
  const ids = suggestionsForMode(r);
  state.suggested = ids;
  auto.applied = key;
  if (!ids.length || key === auto.lock) {
    renderStrip();
    return;
  }
  auto.lock = null;
  const isTemplate = state.mode === 'template';
  const current = isTemplate ? settings.templateId : settings.ideaPoseId;
  if (ids.includes(current)) {
    renderStrip();
    return;
  }
  const next = ids[0];
  if (isTemplate) settings.templateId = next;
  else settings.ideaPoseId = next;
  persist();
  renderStrip();
  renderOverlay();
  updateHint();
  updateCoach();
  const name = isTemplate ? state.templateMap.get(next).name : state.poseMap.get(next).name;
  const where = r.scene ? `${r.scene.emoji} ${r.scene.name}` : r.people >= 2 ? '👥 More people' : '';
  toast(`${where} → ${name}`);
}

function toggleAuto() {
  settings.autoPose = !settings.autoPose;
  persist();
  applyVisualSettings();
  auto.failed = false;
  auto.lock = null;
  auto.applied = null;
  if (!settings.autoPose) state.suggested = [];
  renderStrip();
  updateAuto();
  updateHint();
  toast(settings.autoPose ? '✨ Auto pose on: it follows your background' : 'Auto pose off');
}

// ------------------------------------------------------------------ sheets
function openSheet(el) {
  if (!el.hidden) return;
  el.hidden = false;
  state.sheets.push(el);
  syncScrim();
}
function closeSheet(el) {
  if (!el || el.hidden) return;
  el.hidden = true;
  state.sheets = state.sheets.filter((s) => s !== el);
  syncScrim();
  if (el.id === 'exploreSheet') highlightTab(state.mode);
  if (el.id === 'welcomeSheet') {
    settings.onboarded = true;
    persist();
  }
}
function closeTopSheet() {
  const top = state.sheets[state.sheets.length - 1];
  if (top) closeSheet(top);
  return Boolean(top);
}
function syncScrim() {
  $('scrim').hidden = !state.sheets.some((s) => !s.classList.contains('full'));
}

// ------------------------------------------------------------------ explore
function openExplore() {
  highlightTab('explore');
  renderExplore();
  openSheet($('exploreSheet'));
}

function renderExploreCats() {
  const cats = [
    { id: 'all', name: 'All', emoji: '✨', count: state.poses.length },
    { id: 'favorites', name: 'Favourites', emoji: '❤️', count: settings.favorites.length },
    ...state.categories,
  ];
  $('exploreCats').innerHTML = cats
    .map((c) => `<button class="cat" role="tab" type="button" data-cat="${esc(c.id)}" aria-selected="${c.id === state.exploreCat}">${c.emoji} ${esc(c.name)} <small>${c.count}</small></button>`)
    .join('');
}

function filteredPoses() {
  const q = state.exploreQuery.trim().toLowerCase();
  const favs = new Set(settings.favorites);
  return state.poses.filter((p) => {
    if (state.exploreCat === 'favorites' && !favs.has(p.id)) return false;
    if (state.exploreCat !== 'all' && state.exploreCat !== 'favorites' && p.category !== state.exploreCat) return false;
    if (q && !`${p.name} ${p.description} ${p.category} ${p.difficulty}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function colorVars(p) {
  const [c1, c2] = CATEGORY_COLORS[p.category] || [];
  return c1 ? `--c1:${c1};--c2:${c2}` : '';
}

function renderExplore() {
  renderExploreCats();
  const list = filteredPoses();
  const favs = new Set(settings.favorites);
  $('exploreCount').textContent = `${list.length} pose${list.length === 1 ? '' : 's'}`;
  $('poseGrid').innerHTML = list.length
    ? list
        .map(
          (p) => `<button class="pose-card" type="button" data-pose="${esc(p.id)}">
      <div class="fig" style="${colorVars(p)}">${figureSVG(p, { color: '#fff', fill: 0.2, stroke: 1.7 })}
        ${p.people > 1 ? `<span class="ppl">👥 ${p.people}</span>` : ''}${favs.has(p.id) ? `<span class="fav">${icon('heart')}</span>` : ''}</div>
      <div class="info"><b>${esc(p.name)}</b><span class="meta"><i class="dot-diff ${esc(p.difficulty)}"></i>${esc(p.difficulty)} · ${p.framing === 'half' ? 'Half body' : 'Full body'}</span></div>
    </button>`
        )
        .join('')
    : `<p class="empty">${state.exploreCat === 'favorites' ? 'No favourites yet. Tap the heart on a pose to save it.' : 'No poses match your search.'}</p>`;
}

function openPoseDetail(id) {
  const p = state.poseMap.get(id);
  if (!p) return;
  state.detailPoseId = id;
  const cat = state.categories.find((c) => c.id === p.category);
  const fig = $('poseDetailFig');
  fig.setAttribute('style', colorVars(p));
  fig.innerHTML = figureSVG(p, { color: '#fff', fill: 0.2, stroke: 1.4 });
  $('poseDetailMeta').innerHTML = [
    `<span class="chip"><i class="dot-diff ${esc(p.difficulty)}"></i>${esc(p.difficulty)}</span>`,
    cat ? `<span class="chip">${cat.emoji} ${esc(cat.name)}</span>` : '',
    `<span class="chip">${p.people > 1 ? `👥 ${p.people} people` : '🧍 1 person'}</span>`,
  ].join('');
  $('poseDetailName').textContent = p.name;
  $('poseDetailDesc').textContent = p.description;
  $('poseDetailTips').innerHTML = p.tips.map((t) => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('');
  syncFavButton();
  openSheet($('poseSheet'));
}

function syncFavButton() {
  const on = settings.favorites.includes(state.detailPoseId);
  const b = $('favPoseBtn');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Remove from favourites' : 'Save to favourites');
}

function toggleFavorite() {
  const id = state.detailPoseId;
  const favs = new Set(settings.favorites);
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  settings.favorites = [...favs];
  persist();
  syncFavButton();
  renderExplore();
  if (state.mode === 'idea') renderStrip();
}

function tryPose() {
  settings.ideaPoseId = state.detailPoseId;
  persist();
  closeSheet($('poseSheet'));
  closeSheet($('exploreSheet'));
  setMode('idea');
  auto.lock = auto.applied; // keep the pose the user chose
  renderStrip();
  renderOverlay();
  updateHint();
  const p = state.poseMap.get(settings.ideaPoseId);
  if (p && p.category !== 'selfie' && Number(settings.timer) === 0) toast('Tip: turn on the timer to get into the pose');
}

// ------------------------------------------------------------------ pose coach
let coachRunning = false;
let coachLast = 0;
let smoothScore = 0;
let matchedSince = 0;
let lastAutoShot = 0;

function stopCoach() {
  coachRunning = false;
  $('coach').hidden = true;
  overlay.classList.remove('matched');
  clearSkeleton($('youCanvas'));
  if (!$('hint').hidden) $('hintSub').textContent = defaultHintSub();
}

async function updateCoach() {
  const pose = currentPose();
  if (!settings.coach || !pose || !camera.active || state.viewer) {
    stopCoach();
    return;
  }
  $('coach').hidden = false;
  $('coach').classList.remove('good');
  if (pose.people > 1) {
    coachRunning = false;
    clearSkeleton($('youCanvas'));
    setCoachUi(null, 'The coach works with 1-person poses');
    return;
  }
  if (!coach.ready) {
    setCoachUi(null, 'Loading pose coach…');
    try {
      await coach.load();
    } catch {
      setCoachUi(null, 'Pose coach could not load (offline?)');
      return;
    }
  }
  smoothScore = 0;
  matchedSince = 0;
  if (!coachRunning) {
    coachRunning = true;
    requestAnimationFrame(coachTick);
  }
}

function setCoachUi(score, msg) {
  $('coachScore').textContent = score == null ? '–' : `${Math.round(score * 100)}%`;
  $('hintSub').textContent = msg;
  $('coachRing').style.strokeDashoffset = String(119.4 * (1 - (score || 0)));
}

function coachTick(now) {
  if (!coachRunning) return;
  requestAnimationFrame(coachTick);
  if (now - coachLast < 90 || document.hidden || !camera.active) return;
  coachLast = now;
  const pose = currentPose();
  if (!pose || pose.people > 1) return;
  let lm = null;
  try {
    lm = coach.detect(video);
  } catch {
    return;
  }
  const canvas = $('youCanvas');
  if (!lm) {
    drawSkeleton(canvas, null);
    smoothScore *= 0.8;
    matchedSince = 0;
    setCoachUi(null, 'Step into the frame');
    $('coach').classList.remove('good');
    overlay.classList.remove('matched');
    return;
  }
  const joints = landmarksToJoints(lm, {
    videoW: video.videoWidth,
    videoH: video.videoHeight,
    frameW: frame.clientWidth,
    frameH: frame.clientHeight,
    zoom: camera.digitalZoom,
    mirrored: camera.isFront,
  });
  const { score } = matchScore(pose.figures[0], joints, pose.framing);
  if (score == null) {
    drawSkeleton(canvas, joints, 'rgba(255,255,255,.7)');
    setCoachUi(null, pose.framing === 'half' ? 'Show your upper body' : 'Step back so I can see all of you');
    matchedSince = 0;
    return;
  }
  smoothScore = smoothScore ? smoothScore * 0.6 + score * 0.4 : score;
  const good = smoothScore >= settings.threshold;
  drawSkeleton(canvas, joints, good ? '#3ddc97' : '#ffb547');
  $('coach').classList.toggle('good', good);
  overlay.classList.toggle('matched', good);

  let msg = smoothScore > 0.65 ? 'Almost there…' : 'Match the outline';
  if (good) {
    msg = settings.autoCapture ? 'Perfect! Hold it…' : 'Perfect! Take the shot';
    if (!matchedSince) matchedSince = now;
    if (settings.autoCapture && !state.busy && !state.countdown && !state.viewer && now - matchedSince > 900 && now - lastAutoShot > 4000) {
      lastAutoShot = now;
      matchedSince = 0;
      takePhoto({ auto: true });
    }
  } else {
    matchedSince = 0;
  }
  setCoachUi(smoothScore, msg);
}

// ------------------------------------------------------------------ capture
async function runCountdown(secs) {
  const el = $('countdown');
  const token = {};
  state.countdown = token;
  el.hidden = false;
  for (let s = secs; s > 0; s--) {
    if (state.countdown !== token) break;
    el.innerHTML = `<span>${s}</span>`;
    beep(s === 1 ? 1320 : 880);
    await sleep(1000);
  }
  el.hidden = true;
  const ok = state.countdown === token;
  state.countdown = null;
  return ok;
}

async function flash(on) {
  if (settings.flash !== 'on') return;
  if (!camera.isFront && camera.hasTorch) {
    await camera.setTorch(on);
    if (on) await sleep(400);
  } else if (camera.isFront) {
    $('screenFlash').classList.toggle('on', on);
    if (on) await sleep(250);
  }
}

function blink() {
  const el = $('screenFlash');
  el.classList.remove('blink');
  void el.offsetWidth; // restart the animation
  el.classList.add('blink');
}

async function takePhoto({ auto: isAuto = false } = {}) {
  if (state.countdown) {
    state.countdown = null; // cancel the running timer
    toast('Timer cancelled');
    return;
  }
  if (state.busy) return;
  if (!camera.active) {
    $('fileInput').click();
    return;
  }
  const secs = isAuto ? 0 : Number(settings.timer);
  if (secs > 0 && !(await runCountdown(secs))) return;

  state.busy = true;
  shutter.classList.add('busy');
  try {
    await flash(true);
    const canvas = camera.capture({
      aspect: frame.clientWidth / frame.clientHeight,
      mirror: camera.isFront && settings.mirror,
      filter: currentFilter().css,
    });
    await flash(false);
    shutterSound();
    blink();
    if (state.mode === 'template') {
      await runTemplate(canvas);
    } else {
      const blob = await canvasToBlob(canvas, 'image/jpeg', settings.jpeg);
      const pose = state.mode === 'idea' ? currentPose() : null;
      const rec = await addPhoto({ blob, kind: 'photo', title: pose ? pose.name : 'Photo', width: canvas.width, height: canvas.height });
      await refreshThumb(rec);
      toast(isAuto ? '📸 Pose matched: photo saved' : 'Saved to gallery');
    }
  } catch (err) {
    await flash(false);
    toast(err.message || 'Could not take the photo');
  } finally {
    state.busy = false;
    shutter.classList.remove('busy');
  }
}

// ------------------------------------------------------------------ templates & AI
/**
 * Restyle `source` with a template: save + show an instant preview right
 * away, then replace it with the AI edit when it arrives.
 */
async function runTemplate(source, { templateId = settings.templateId, sourceRec = null } = {}) {
  const t = state.templateMap.get(templateId);
  if (!t) throw new Error('Templates are not loaded yet');
  const original = source instanceof HTMLCanvasElement && Math.max(source.width, source.height) <= 2048 ? source : toCanvas(source, 2048);

  let srcRec = sourceRec;
  if (!srcRec && settings.keepOriginal) {
    const blob = await canvasToBlob(original, 'image/jpeg', settings.jpeg);
    srcRec = await addPhoto({ blob, kind: 'original', title: 'Original', width: original.width, height: original.height });
  }
  const preview = applyLook(original, t.look);
  const previewBlob = await canvasToBlob(preview, 'image/jpeg', 0.92);
  const rec = await addPhoto({
    blob: previewBlob,
    kind: 'preview',
    title: t.name,
    templateId: t.id,
    sourceId: srcRec ? srcRec.id : null,
    width: preview.width,
    height: preview.height,
  });
  await refreshThumb(rec);
  openViewer(rec, { source: original });
  requestAi(rec, original, t);
}

const pending = new Map(); // record id -> AbortController

async function requestAi(rec, original, t) {
  if (!state.ai.enabled) {
    showViewerNote(rec.id, 'Instant preview. For the full AI edit, add an OPENAI_API_KEY to the server’s .env file.', 'info');
    return;
  }
  const ctrl = new AbortController();
  pending.set(rec.id, ctrl);
  syncViewerProgress();
  try {
    const small = toCanvas(original, 1536);
    const res = await api.edit(
      { image: small.toDataURL('image/jpeg', 0.9), templateId: t.id, width: small.width, height: small.height, quality: settings.aiQuality },
      ctrl.signal
    );
    const blob = await (await fetch(res.image)).blob();
    const updated = await updatePhoto(rec.id, { blob, kind: 'ai', provider: res.provider });
    await refreshThumb();
    if (state.viewer && state.viewer.rec.id === rec.id) {
      setViewerRecord(updated || { ...rec, blob, kind: 'ai' });
      showViewerNote(rec.id, `✨ AI edit ready in ${(res.ms / 1000).toFixed(1)} s`, 'info', 2500);
    } else {
      toast(`✨ Your “${t.name}” photo is ready in the gallery`, 3000);
    }
    if (!$('gallerySheet').hidden) renderGallery();
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (err.code === 'AI_NOT_CONFIGURED') {
      state.ai.enabled = false;
      updateAiStatus();
      updateHint();
      showViewerNote(rec.id, 'Instant preview. AI editing is not configured on the server.', 'info');
    } else {
      showViewerNote(rec.id, `AI edit failed: ${err.message} Showing the instant preview.`, 'warn');
      if (state.viewer && state.viewer.rec.id === rec.id) $('retryAiBtn').hidden = false;
    }
  } finally {
    pending.delete(rec.id);
    syncViewerProgress();
  }
}

// ------------------------------------------------------------------ viewer
function setViewerRecord(rec) {
  const v = state.viewer;
  if (v.url) URL.revokeObjectURL(v.url);
  v.rec = rec;
  v.url = URL.createObjectURL(rec.blob);
  $('viewerImg').src = v.url;
  const t = rec.templateId && state.templateMap.get(rec.templateId);
  const label = rec.kind === 'ai' ? '✨ AI' : rec.kind === 'preview' ? 'Preview' : rec.kind === 'original' ? 'Original' : '';
  $('viewerTitle').textContent = [t ? `${t.emoji} ${t.name}` : rec.title || 'Photo', label].filter(Boolean).join(' · ');
}

async function openViewer(rec, { source = null } = {}) {
  closeViewer(true);
  state.viewer = { rec, url: null, source, beforeUrl: null };
  setViewerRecord(rec);
  $('viewerNote').hidden = true;
  $('retryAiBtn').hidden = true;
  $('compareBtn').hidden = true;
  $('restyle').hidden = true;
  $('viewer').hidden = false;
  stopCoach();
  updateAuto();

  // The "before" image (for compare) and the restyle strip need the source photo.
  let sourceBlob = null;
  if (rec.kind === 'photo' || rec.kind === 'original') sourceBlob = rec.blob;
  else if (rec.sourceId) {
    const src = (await listPhotos()).find((p) => p.id === rec.sourceId);
    if (src) sourceBlob = src.blob;
  }
  if (!state.viewer || state.viewer.rec.id !== rec.id) return;
  if (!sourceBlob && source) sourceBlob = await canvasToBlob(source, 'image/jpeg', 0.9);
  state.viewer.sourceBlob = sourceBlob;
  const stylized = rec.kind === 'ai' || rec.kind === 'preview';
  if (sourceBlob && stylized) {
    state.viewer.beforeUrl = URL.createObjectURL(sourceBlob);
    $('viewerBefore').src = state.viewer.beforeUrl;
  }
  $('compareBtn').hidden = !(sourceBlob && stylized);
  renderRestyle();
  syncViewerProgress();
}

function renderRestyle() {
  const v = state.viewer;
  const show = Boolean(v && v.sourceBlob && state.templates.length);
  $('restyle').hidden = !show;
  if (show) $('restyleStrip').innerHTML = state.templates.map((t) => templateTile(t, v.rec.templateId)).join('');
}

async function restyle(templateId) {
  const v = state.viewer;
  if (!v || !v.sourceBlob) return;
  const img = await blobToImage(v.sourceBlob);
  const sourceRec = v.rec.kind === 'photo' || v.rec.kind === 'original' ? v.rec : v.rec.sourceId ? { id: v.rec.sourceId } : null;
  settings.templateId = templateId;
  persist();
  await runTemplate(toCanvas(img, 2048), { templateId, sourceRec });
  if (state.mode === 'template') {
    renderStrip();
    renderOverlay();
    updateHint();
  }
}

function syncViewerProgress() {
  const v = state.viewer;
  const busy = Boolean(v && pending.has(v.rec.id));
  $('aiProgress').hidden = !busy;
  if (busy) $('viewerNote').hidden = true;
}

let noteTimer;
function showViewerNote(recId, text, kind = 'info', ms = 0) {
  if (!state.viewer || state.viewer.rec.id !== recId) return;
  const el = $('viewerNote');
  el.textContent = text;
  el.className = `viewer-note ${kind}`;
  el.hidden = false;
  clearTimeout(noteTimer);
  if (ms) noteTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function closeViewer(silent = false) {
  const v = state.viewer;
  if (!v) return;
  if (v.url) URL.revokeObjectURL(v.url);
  if (v.beforeUrl) URL.revokeObjectURL(v.beforeUrl);
  state.viewer = null;
  $('viewer').hidden = true;
  showBefore(false);
  if (!silent) {
    updateCoach();
    updateAuto();
  }
}

function showBefore(on) {
  $('viewerBefore').hidden = !on;
  $('beforeTag').hidden = !on;
}

function downloadName(rec) {
  const d = new Date(rec.createdAt || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const ext = rec.blob.type === 'image/png' ? 'png' : 'jpg';
  return `magic-pose-${rec.templateId || rec.kind}-${stamp}.${ext}`;
}

function downloadCurrent() {
  const v = state.viewer;
  if (!v) return;
  const a = document.createElement('a');
  a.href = v.url;
  a.download = downloadName(v.rec);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function shareCurrent() {
  const v = state.viewer;
  if (!v) return;
  const file = new File([v.rec.blob], downloadName(v.rec), { type: v.rec.blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Magic Pose' });
    } catch { /* cancelled */ }
  } else {
    downloadCurrent();
    toast('Sharing isn’t supported here, so it was downloaded instead');
  }
}

async function deleteCurrent() {
  const v = state.viewer;
  if (!v) return;
  if (!window.confirm('Delete this photo from the gallery?')) return;
  const ctrl = pending.get(v.rec.id);
  if (ctrl) ctrl.abort();
  await deletePhoto(v.rec.id);
  closeViewer();
  await refreshThumb();
  if (!$('gallerySheet').hidden) renderGallery();
  toast('Photo deleted');
}

// ------------------------------------------------------------------ gallery
async function refreshThumb(rec) {
  const latest = rec || (await latestPhoto());
  const img = $('galleryThumb');
  if (state.thumbUrl) URL.revokeObjectURL(state.thumbUrl);
  state.thumbUrl = null;
  if (!latest) {
    img.hidden = true;
    return;
  }
  state.thumbUrl = URL.createObjectURL(latest.blob);
  img.src = state.thumbUrl;
  img.hidden = false;
}

async function renderGallery() {
  state.galleryUrls.forEach((u) => URL.revokeObjectURL(u));
  state.galleryUrls = [];
  const photos = await listPhotos();
  $('galleryCount').textContent = photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : '';
  $('galleryEmpty').hidden = photos.length > 0;
  $('galleryGrid').innerHTML = photos
    .map((p) => {
      const url = URL.createObjectURL(p.blob);
      state.galleryUrls.push(url);
      const tag = p.kind === 'ai' ? '<span class="tag ai">✨ AI</span>' : p.kind === 'preview' ? '<span class="tag">Preview</span>' : p.kind === 'original' ? '<span class="tag">Original</span>' : '';
      return `<button type="button" data-id="${p.id}"><img src="${url}" alt="${esc(p.title || 'Photo')}" loading="lazy">${tag}</button>`;
    })
    .join('');
}

async function openGallery() {
  await renderGallery();
  openSheet($('gallerySheet'));
}

async function updateUsage() {
  const u = await usage();
  $('galleryUsage').textContent = `${u.count} photo${u.count === 1 ? '' : 's'} · ${(u.bytes / (1024 * 1024)).toFixed(1)} MB on this device`;
}

// ------------------------------------------------------------------ upload a photo
function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

async function onFileChosen(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const img = await blobToImage(file);
    if (state.mode !== 'template') setMode('template');
    state.busy = true;
    await runTemplate(toCanvas(img, 2048));
  } catch (err) {
    toast(err.message);
  } finally {
    state.busy = false;
  }
}

// ------------------------------------------------------------------ AI status
function updateAiStatus() {
  const el = $('aiStatus');
  if (state.ai.enabled) {
    el.textContent = state.ai.provider === 'mock' ? 'Test mode' : `Connected · ${state.ai.model}`;
    el.className = 'status ok';
  } else {
    el.textContent = 'Off: instant previews only';
    el.className = 'status off';
  }
}

// ------------------------------------------------------------------ events
function bindEvents() {
  shutter.addEventListener('click', () => takePhoto());
  $('flipBtn').addEventListener('click', flipCamera);
  $('galleryBtn').addEventListener('click', openGallery);
  $('settingsBtn').addEventListener('click', () => {
    fillSettingsForm();
    updateUsage();
    openSheet($('settingsSheet'));
  });
  $('gridBtn').addEventListener('click', () => {
    settings.grid = !settings.grid;
    persist();
    applyVisualSettings();
  });
  $('flashBtn').addEventListener('click', () => {
    settings.flash = settings.flash === 'on' ? 'off' : 'on';
    persist();
    applyVisualSettings();
    if (settings.flash === 'on') {
      if (camera.isFront) toast('Screen flash on');
      else if (!camera.hasTorch) toast('This camera has no flash');
      else toast('Flash on');
    } else {
      toast('Flash off');
    }
  });
  $('timerBtn').addEventListener('click', () => {
    const i = TIMERS.indexOf(settings.timer);
    settings.timer = TIMERS[(i + 1) % TIMERS.length] || '0';
    persist();
    applyVisualSettings();
    toast(settings.timer === '0' ? 'Timer off' : `Timer: ${settings.timer} seconds`);
  });
  $('ratioBtn').addEventListener('click', () => {
    const keys = Object.keys(RATIOS);
    settings.ratio = keys[(keys.indexOf(settings.ratio) + 1) % keys.length];
    persist();
    applyVisualSettings();
  });
  $('filterBtn').addEventListener('click', () => {
    const i = FILTERS.findIndex((f) => f.id === settings.filter);
    settings.filter = FILTERS[(i + 1) % FILTERS.length].id;
    persist();
    applyVisualSettings();
    toast(`Filter: ${currentFilter().name}`);
  });
  $('zoom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) setZoom(Number(b.dataset.zoom));
  });
  $('modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  $('dockHelp').addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (b) setMode(b.dataset.goto);
  });
  $('strip').addEventListener('click', onStripClick);
  $('pickerMore').addEventListener('click', openExplore);
  $('hintBtn').addEventListener('click', openExplore);
  $('autoBtn').addEventListener('click', toggleAuto);
  $('retryCamBtn').addEventListener('click', startCamera);
  $('uploadBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', onFileChosen);
  $('welcomeBtn').addEventListener('click', () => closeSheet($('welcomeSheet')));

  // Sheets
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet(b.closest('.sheet'))));
  $('scrim').addEventListener('click', closeTopSheet);

  // Explore
  $('exploreSearch').addEventListener('input', (e) => {
    state.exploreQuery = e.target.value;
    renderExplore();
  });
  $('exploreCats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.exploreCat = b.dataset.cat;
    renderExplore();
  });
  $('poseGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-pose]');
    if (card) openPoseDetail(card.dataset.pose);
  });
  $('tryPoseBtn').addEventListener('click', tryPose);
  $('favPoseBtn').addEventListener('click', toggleFavorite);

  // Settings
  $('settingsForm').addEventListener('input', onSettingChange);
  $('settingsForm').addEventListener('change', onSettingChange);
  $('colorSwatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    settings.overlayColor = b.dataset.color;
    persist();
    for (const s of $('colorSwatches').children) s.setAttribute('aria-checked', String(s === b));
    renderOverlay();
  });
  $('clearGalleryBtn').addEventListener('click', async () => {
    if (!window.confirm('Delete every photo in the Magic Pose gallery on this device?')) return;
    await clearPhotos();
    await refreshThumb();
    await updateUsage();
    toast('Gallery cleared');
  });

  // Gallery
  $('galleryGrid').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const rec = (await listPhotos()).find((p) => p.id === Number(b.dataset.id));
    if (rec) openViewer(rec);
  });

  // Viewer
  $('viewerClose').addEventListener('click', () => closeViewer());
  $('viewerDelete').addEventListener('click', deleteCurrent);
  $('saveBtn').addEventListener('click', downloadCurrent);
  $('shareBtn').addEventListener('click', shareCurrent);
  $('retryAiBtn').addEventListener('click', async () => {
    const v = state.viewer;
    if (!v || !v.sourceBlob) return;
    $('retryAiBtn').hidden = true;
    const img = await blobToImage(v.sourceBlob);
    requestAi(v.rec, toCanvas(img, 2048), state.templateMap.get(v.rec.templateId));
  });
  $('restyleStrip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-template]');
    if (b) restyle(b.dataset.template).catch((err) => toast(err.message));
  });
  const compare = $('compareBtn');
  compare.addEventListener('pointerdown', () => showBefore(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => compare.addEventListener(ev, () => showBefore(false)));

  // Swipe on the camera to change mode
  let swipe = null;
  frame.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
  frame.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = MODE_ORDER[MODE_ORDER.indexOf(state.mode) + (dx < 0 ? 1 : -1)];
    if (next && next !== 'explore') setMode(next);
  });

  // Keyboard (desktop)
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'Escape') {
      if (state.viewer) closeViewer();
      else closeTopSheet();
    } else if ((e.key === ' ' || e.key === 'Enter') && !state.viewer && !state.sheets.length && !e.target.closest('button')) {
      e.preventDefault();
      takePhoto();
    }
  });

  // Save battery: release the camera when the app is in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCoach();
      camera.stop();
      updateAuto();
    } else if (!camera.active) {
      startCamera();
    }
  });
}

// ------------------------------------------------------------------ boot
async function loadCatalog() {
  const [cfg, categories, poses, templates] = await Promise.all([api.config(), api.categories(), api.poses(), api.templates()]);
  state.ai = cfg.ai;
  $('versionLabel').textContent = `v${cfg.version}`;
  state.categories = categories;
  state.poses = poses;
  state.poseMap = new Map(poses.map((p) => [p.id, p]));
  state.templates = templates;
  state.templateMap = new Map(templates.map((t) => [t.id, t]));
  if (!state.poseMap.has(settings.ideaPoseId)) settings.ideaPoseId = poses[0].id;
  if (!state.templateMap.has(settings.templateId)) settings.templateId = templates[0].id;
}

async function init() {
  applyVisualSettings();
  fillSettingsForm();
  bindEvents();
  refreshThumb();
  const cam = startCamera();
  try {
    await loadCatalog();
  } catch {
    toast('Could not load poses. Is the server running?', 5000);
  }
  updateAiStatus();
  setMode('photo');
  if (!settings.onboarded) openSheet($('welcomeSheet'));
  await cam;
}

init();
