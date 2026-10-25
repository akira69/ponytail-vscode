const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const crypto = require('node:crypto');
const { getEffectiveMode, readMode, writeMode } = require('../../shared/mode-state.cjs');

function setup(t, home, defaultMode) {
  const keys = ['CLAUDE_CONFIG_DIR', 'XDG_CONFIG_HOME', 'PONYTAIL_DEFAULT_MODE'];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.CLAUDE_CONFIG_DIR = path.join(home, '.claude');
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  if (defaultMode === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
  else process.env.PONYTAIL_DEFAULT_MODE = defaultMode;
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(home, { recursive: true, force: true });
  });
  return { stateDir: process.env.CLAUDE_CONFIG_DIR, configDir: process.env.XDG_CONFIG_HOME };
}

test('writes the workspace hash and shared Ponytail state', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-home-'));
  const { stateDir } = setup(t, home);
  const workspace = path.join(home, 'repo');
  const hash = crypto.createHash('sha256').update(path.normalize(workspace)).digest('hex');
  writeMode('ultra', workspace);
  assert.equal(readMode(workspace), 'ultra');
  assert.equal(fs.readFileSync(path.join(stateDir, 'ponytail-modes', hash), 'utf8'), 'ultra');
  assert.equal(fs.readFileSync(path.join(stateDir, '.ponytail-active'), 'utf8'), 'ultra');
});

test('does not leak mode between workspace roots', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-home-'));
  setup(t, home);
  writeMode('lite', path.join(home, 'one'));
  writeMode('full', path.join(home, 'two'));
  assert.equal(readMode(path.join(home, 'one')), 'lite');
  assert.equal(readMode(path.join(home, 'two')), 'full');
});

test('reads shared state without a workspace root', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-home-'));
  setup(t, home);
  writeMode('off');
  assert.equal(readMode(), 'off');
});

test('rejects invalid writes without changing existing workspace state', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-home-'));
  setup(t, home);
  const workspace = path.join(home, 'repo');
  writeMode('lite', workspace);
  assert.throws(() => writeMode('review', workspace), /Invalid Ponytail mode/);
  assert.equal(readMode(workspace), 'lite');
});

test('uses the environment default before a BOM-prefixed config', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-home-'));
  const { configDir } = setup(t, home, 'lite');
  fs.mkdirSync(path.join(configDir, 'ponytail'), { recursive: true });
  fs.writeFileSync(path.join(configDir, 'ponytail', 'config.json'), '\uFEFF{"defaultMode":"ultra"}');
  assert.equal(getEffectiveMode(path.join(home, 'repo')), 'lite');
  process.env.PONYTAIL_DEFAULT_MODE = 'invalid';
  assert.equal(getEffectiveMode(path.join(home, 'repo')), 'ultra');
});

test('ignores invalid persisted mode and falls back to the configured mode', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-home-'));
  const { stateDir, configDir } = setup(t, home, 'invalid');
  fs.mkdirSync(path.join(configDir, 'ponytail'), { recursive: true });
  fs.writeFileSync(path.join(configDir, 'ponytail', 'config.json'), '{"defaultMode":"ultra"}');
  writeMode('full', path.join(home, 'repo'));
  const hash = crypto.createHash('sha256').update(path.normalize(path.join(home, 'repo'))).digest('hex');
  fs.writeFileSync(path.join(stateDir, 'ponytail-modes', hash), 'not-a-mode');
  assert.equal(getEffectiveMode(path.join(home, 'repo')), 'ultra');
});
