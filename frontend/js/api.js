/* Thin wrappers around the backend API. */

async function request(path, options = {}) {
  const res = await fetch(`api${path}`, options);
  let body = null;
  try { body = await res.json(); } catch { /* empty or not JSON */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body && body.code;
    throw err;
  }
  return body;
}

export const api = {
  config: () => request('/config'),
  categories: () => request('/categories').then((r) => r.categories),
  poses: () => request('/poses').then((r) => r.poses),
  templates: () => request('/templates').then((r) => r.templates),
  /** Restyle a photo with a template. Resolves to { image, provider, ms }. */
  edit: ({ image, templateId, width, height, quality }, signal) =>
    request('/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, templateId, width, height, quality }),
      signal,
    }),
};
