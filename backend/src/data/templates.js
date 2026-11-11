'use strict';
/*
 * Template mode: each template pairs a pose (shown as an outline on the
 * camera) with a style. After the photo is taken it is sent to the AI image
 * editor with `prompt`; `look` is a recipe for the instant on-device preview
 * that is shown straight away (and used when no AI provider is configured).
 *
 * look = {
 *   filter:   CSS/canvas filter string applied to the photo
 *   tint:     { colors: [top, bottom], blend, alpha }  gradient colour wash
 *   vignette: 0..1, grain: 0..1
 *   effect:   'none' | 'glow' | 'posterize' | 'sketch' | 'paint'
 * }
 */

const TEMPLATES = [
  {
    id: 'neon-nights', name: 'Neon Nights', poseId: 'power-stance', emoji: '🌃',
    swatch: ['#ff2bd6', '#2b5bff'],
    prompt: 'Place the person on a rainy cyberpunk city street at night, surrounded by glowing pink and blue neon signs, wet reflective pavement and light haze. Add a cinematic neon rim light on the person and a stylish futuristic jacket.',
    medium: 'cinematic night photograph',
    look: { filter: 'contrast(1.25) saturate(1.5) brightness(0.9)', tint: { colors: ['#ff2bd6', '#2b5bff'], blend: 'overlay', alpha: 0.6 }, vignette: 0.55, grain: 0.08, effect: 'glow' },
  },
  {
    id: 'golden-hour', name: 'Golden Hour', poseId: 'hair-touch', emoji: '🌅',
    swatch: ['#ffb347', '#ff6a3d'],
    prompt: 'Place the person on a beach at golden hour with warm low sunlight behind them, soft lens flare, glowing hair light and a gentle ocean in the background.',
    medium: 'warm golden-hour portrait photograph',
    look: { filter: 'contrast(1.05) saturate(1.25) sepia(0.2) brightness(1.05)', tint: { colors: ['#ffcc70', '#ff7b3d'], blend: 'soft-light', alpha: 0.8 }, vignette: 0.35, grain: 0.04, effect: 'glow' },
  },
  {
    id: 'studio-editorial', name: 'Studio Editorial', poseId: 'editorial-hip', emoji: '📸',
    swatch: ['#e9e4dc', '#9c8f80'],
    prompt: 'Turn the photo into a high-fashion studio editorial shot with a seamless warm-grey paper backdrop, professional softbox lighting and an elegant designer outfit.',
    medium: 'high-end fashion studio photograph',
    look: { filter: 'contrast(1.15) saturate(0.85) brightness(1.05)', tint: { colors: ['#f2ede6', '#b8ab9c'], blend: 'soft-light', alpha: 0.5 }, vignette: 0.25, grain: 0.03, effect: 'none' },
  },
  {
    id: 'superhero', name: 'Superhero', poseId: 'hands-on-hips', emoji: '🦸',
    swatch: ['#d7263d', '#1b3b8a'],
    prompt: 'Transform the person into an original superhero with a sleek suit and a flowing cape, standing heroically on a rooftop above a city skyline at dusk with dramatic clouds.',
    medium: 'epic cinematic movie still',
    look: { filter: 'contrast(1.35) saturate(1.3)', tint: { colors: ['#ff4d4d', '#1b3b8a'], blend: 'overlay', alpha: 0.45 }, vignette: 0.6, grain: 0.05, effect: 'glow' },
  },
  {
    id: 'anime', name: 'Anime', poseId: 'victory', emoji: '🎌',
    swatch: ['#7ad0ff', '#ffb3d9'],
    prompt: 'Redraw the photo as a vibrant Japanese anime illustration with clean line art, cel shading, big expressive eyes and a bright sky with fluffy clouds in the background.',
    medium: 'anime illustration',
    look: { filter: 'contrast(1.2) saturate(1.6) brightness(1.08)', tint: { colors: ['#7ad0ff', '#ffb3d9'], blend: 'soft-light', alpha: 0.5 }, vignette: 0, grain: 0, effect: 'posterize' },
  },
  {
    id: 'retro-film', name: 'Retro Film', poseId: 'leaning-cross', emoji: '🎞️',
    swatch: ['#d9a066', '#5b8c85'],
    prompt: 'Make the photo look like it was taken in the 1970s on analog film: retro clothing, faded warm colours, soft focus, film grain and light leaks, on a sunny street with vintage cars.',
    medium: 'vintage 1970s film photograph',
    look: { filter: 'contrast(0.9) saturate(0.8) sepia(0.35) brightness(1.05)', tint: { colors: ['#ffb36b', '#3f8f86'], blend: 'soft-light', alpha: 0.6 }, vignette: 0.45, grain: 0.18, effect: 'none' },
  },
  {
    id: 'watercolor', name: 'Watercolor', poseId: 'thinker', emoji: '🎨',
    swatch: ['#9ad1d4', '#f7d6e0'],
    prompt: 'Repaint the photo as a delicate watercolor painting on textured paper with soft bleeding edges, gentle pastel washes and loose brush strokes.',
    medium: 'watercolor painting',
    look: { filter: 'contrast(0.95) saturate(1.2) brightness(1.1)', tint: { colors: ['#bfe3e5', '#f7d6e0'], blend: 'multiply', alpha: 0.35 }, vignette: 0, grain: 0.06, effect: 'paint' },
  },
  {
    id: 'royal-portrait', name: 'Royal Portrait', poseId: 'chair-relaxed', emoji: '👑',
    swatch: ['#5a3a1a', '#c9a227'],
    prompt: 'Repaint the photo as a Renaissance royal oil portrait: the person seated on an ornate throne wearing regal velvet robes and a jewelled crown, with a dark rich background and dramatic chiaroscuro lighting.',
    medium: 'classical oil painting',
    look: { filter: 'contrast(1.2) saturate(0.9) sepia(0.45) brightness(0.9)', tint: { colors: ['#c9a227', '#3b2412'], blend: 'overlay', alpha: 0.55 }, vignette: 0.75, grain: 0.1, effect: 'paint' },
  },
  {
    id: 'cover-star', name: 'Cover Star', poseId: 'arms-crossed', emoji: '⭐',
    swatch: ['#111111', '#e63946'],
    prompt: 'Turn the photo into a glossy celebrity magazine cover-style portrait with a bold solid red background, crisp beauty lighting and a stylish outfit. Do not add any text.',
    medium: 'glossy magazine cover photograph',
    look: { filter: 'contrast(1.3) saturate(1.15) brightness(1.03)', tint: { colors: ['#e63946', '#111111'], blend: 'soft-light', alpha: 0.4 }, vignette: 0.3, grain: 0.02, effect: 'none' },
  },
  {
    id: 'space-walk', name: 'Space Walk', poseId: 'star-jump', emoji: '🚀',
    swatch: ['#0b1a3a', '#7b2ff7'],
    prompt: 'Place the person floating in outer space in a sleek white astronaut suit with the helmet visor open so the face is visible, with Earth glowing below and a colourful nebula and stars behind.',
    medium: 'sci-fi space photograph',
    look: { filter: 'contrast(1.2) saturate(1.3) brightness(0.85) hue-rotate(-10deg)', tint: { colors: ['#7b2ff7', '#0b1a3a'], blend: 'screen', alpha: 0.35 }, vignette: 0.7, grain: 0.05, effect: 'glow' },
  },
  {
    id: 'winter-wonder', name: 'Winter Wonderland', poseId: 'the-wave', emoji: '❄️',
    swatch: ['#dff3ff', '#6aa9d8'],
    prompt: 'Place the person in a snowy winter wonderland with gently falling snowflakes, frosted pine trees and soft blue light, wearing a cosy knitted scarf and winter coat.',
    medium: 'magical winter photograph',
    look: { filter: 'contrast(1.05) saturate(0.85) brightness(1.12) hue-rotate(10deg)', tint: { colors: ['#e8f6ff', '#6aa9d8'], blend: 'soft-light', alpha: 0.7 }, vignette: 0.3, grain: 0.03, effect: 'glow' },
  },
  {
    id: 'cartoon-3d', name: '3D Cartoon', poseId: 'heart-hands', emoji: '🧸',
    swatch: ['#ffd166', '#06d6a0'],
    prompt: 'Transform the person into a cute, original 3D animated movie character with soft rounded features, big friendly eyes, smooth stylised skin and a colourful blurred background.',
    medium: '3D animated character render',
    look: { filter: 'contrast(1.1) saturate(1.5) brightness(1.08)', tint: { colors: ['#ffd166', '#06d6a0'], blend: 'soft-light', alpha: 0.45 }, vignette: 0.15, grain: 0, effect: 'posterize' },
  },
  {
    id: 'pencil-sketch', name: 'Pencil Sketch', poseId: 'classic-selfie', emoji: '✏️',
    swatch: ['#f4f1ea', '#555555'],
    prompt: 'Redraw the photo as a detailed graphite pencil sketch on cream sketchbook paper with fine cross-hatching and soft shading.',
    medium: 'graphite pencil drawing',
    look: { filter: 'grayscale(1) contrast(1.2)', tint: { colors: ['#f4f1ea', '#d9d2c3'], blend: 'multiply', alpha: 0.6 }, vignette: 0.1, grain: 0.12, effect: 'sketch' },
  },
  {
    id: 'sunset-couple', name: 'Sunset Love', poseId: 'holding-hands', emoji: '💞',
    swatch: ['#ff9a8b', '#6a3093'],
    prompt: 'Place the people on a hilltop at sunset with a dreamy pink and purple sky, warm backlight and soft bokeh, like a romantic engagement photo.',
    medium: 'romantic sunset photograph',
    look: { filter: 'contrast(1.05) saturate(1.3) brightness(1.02)', tint: { colors: ['#ff9a8b', '#6a3093'], blend: 'soft-light', alpha: 0.75 }, vignette: 0.45, grain: 0.04, effect: 'glow' },
  },
];

module.exports = { TEMPLATES };
