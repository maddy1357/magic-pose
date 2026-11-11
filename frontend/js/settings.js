/* User settings, kept in localStorage (a per-device convenience; safe to lose). */

const KEY = 'magic-pose:settings:v1';

export const DEFAULTS = Object.freeze({
  resolution: '1080',
  ratio: '3:4',
  timer: '0',
  mirror: true,
  grid: false,
  sound: true,
  jpeg: 0.92,
  overlayColor: '#ffffff',
  overlayOpacity: 0.9,
  overlaySize: 1,
  coach: false,
  autoCapture: false,
  threshold: 0.8,
  aiQuality: 'medium',
  keepOriginal: true,
  // remembered state
  facing: 'user',
  filter: 'normal',
  flash: 'off',
  ideaPoseId: 'hands-on-hips',
  templateId: 'neon-nights',
  favorites: [],
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadSettings() {
  const saved = read();
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (k in saved && typeof saved[k] === typeof DEFAULTS[k]) out[k] = saved[k];
  }
  if (!Array.isArray(out.favorites)) out.favorites = [];
  return out;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode or storage full: settings just won't persist */
  }
}
