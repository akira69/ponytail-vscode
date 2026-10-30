const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getClaudeDir, getConfigPath, getDefaultMode, normalizeMode } = require('../hooks/ponytail-config.js');

function sharedPath() {
  return path.join(getClaudeDir(), '.ponytail-active');
}

function workspacePath(workspaceRoot) {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim() === '') return null;
  const hash = crypto.createHash('sha256').update(path.normalize(workspaceRoot)).digest('hex');
  return path.join(getClaudeDir(), 'ponytail-modes', hash);
}

// With a workspace root, only that workspace's file is read (no shared fallback), matching upstream.
function readMode(workspaceRoot) {
  const file = workspacePath(workspaceRoot) || sharedPath();
  try {
    return normalizeMode(fs.readFileSync(file, 'utf8').trim());
  } catch {
    return null;
  }
}

function writeMode(mode, workspaceRoot) {
  const normalized = normalizeMode(mode);
  if (!normalized) throw new TypeError('Invalid Ponytail mode');
  const paths = [sharedPath(), workspacePath(workspaceRoot)].filter(Boolean);
  for (const file of paths) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, normalized, 'utf8');
  }
}

function getEffectiveMode(workspaceRoot) {
  return readMode(workspaceRoot) || getDefaultMode();
}

function watchMode(workspaceRoot, listener) {
  const files = [workspacePath(workspaceRoot) || sharedPath(), getConfigPath()];
  // Polling also observes files created after activation and survives atomic replacements.
  for (const file of files) fs.watchFile(file, { persistent: false, interval: 1000 }, listener);
  return { dispose() { for (const file of files) fs.unwatchFile(file, listener); } };
}

module.exports = { getEffectiveMode, readMode, writeMode, watchMode };
