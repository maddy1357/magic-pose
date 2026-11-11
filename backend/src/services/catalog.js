'use strict';
/* Builds the pose and template catalogue once, with joint coordinates ready to draw. */
const { CATEGORIES, POSES } = require('../data/poses');
const { TEMPLATES } = require('../data/templates');
const { buildFigure, autoView } = require('../lib/skeleton');

const poses = POSES.map((p) => {
  const figures = p.figures.map(buildFigure);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    difficulty: p.difficulty,
    framing: p.framing || 'full',
    people: figures.length,
    description: p.description,
    tips: p.tips,
    view: p.view || autoView(figures, p.framing),
    figures,
  };
});
const poseById = new Map(poses.map((p) => [p.id, p]));

const templates = TEMPLATES.map((t) => {
  const pose = poseById.get(t.poseId);
  if (!pose) throw new Error(`Template "${t.id}" uses unknown pose "${t.poseId}"`);
  return { id: t.id, name: t.name, emoji: t.emoji, poseId: t.poseId, swatch: t.swatch, medium: t.medium, look: t.look };
});
const templateById = new Map(TEMPLATES.map((t) => [t.id, t]));

const categories = CATEGORIES.map((c) => ({ ...c, count: poses.filter((p) => p.category === c.id).length }));

/** The instruction sent to the image model for a template. */
function buildPrompt(templateId) {
  const t = templateById.get(templateId);
  if (!t) return null;
  const pose = poseById.get(t.poseId);
  const who = pose.people > 1 ? 'every person in the photo' : 'the person in the photo';
  const poseText = `${pose.name.toLowerCase()}: ${pose.description.replace(/\.$/, '').toLowerCase()}`;
  return [
    `Edit this photo. ${t.prompt}`,
    `Keep ${who} recognisable: preserve their face, identity, facial features, skin tone, hairstyle and body shape exactly.`,
    `Keep their pose (${poseText}) and the camera framing.`,
    `The result should look like a polished, high-quality ${t.medium}.`,
    'Do not add text, logos, watermarks or extra people.',
  ].join(' ');
}

module.exports = { poses, poseById, templates, templateById, categories, buildPrompt };
