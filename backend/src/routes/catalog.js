'use strict';
const express = require('express');
const { poses, poseById, templates, categories } = require('../services/catalog');

const router = express.Router();

router.get('/categories', (req, res) => res.json({ categories }));

router.get('/poses', (req, res) => {
  const { category, q, people } = req.query;
  let list = poses;
  if (category) list = list.filter((p) => p.category === category);
  if (people) list = list.filter((p) => p.people === Number(people));
  if (q) {
    const needle = String(q).toLowerCase().trim();
    list = list.filter((p) => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(needle));
  }
  res.json({ count: list.length, poses: list });
});

router.get('/poses/:id', (req, res) => {
  const pose = poseById.get(req.params.id);
  if (!pose) return res.status(404).json({ error: 'Pose not found' });
  res.json({ pose });
});

router.get('/templates', (req, res) => res.json({ count: templates.length, templates }));

module.exports = router;
