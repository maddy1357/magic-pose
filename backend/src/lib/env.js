'use strict';
const fs = require('fs');

/**
 * Minimal .env loader (KEY=value lines, # comments, optional quotes).
 * Variables that are already set in the environment are never overwritten.
 */
function loadEnvFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = rawValue.trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    process.env[key] = value;
  }
  return true;
}

module.exports = { loadEnvFile };
