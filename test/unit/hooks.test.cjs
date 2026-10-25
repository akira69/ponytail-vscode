const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { writeMode } = require('../../shared/mode-state.cjs');
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions.js');

const root = path.join(__dirname, '..', '..');
const hook = path.join(root, 'com.github.copilot', 'hooks', 'subagent-start.cjs');

function tempHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hook-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

function env(home, extra = {}) {
  const base = { ...process.env };
  delete base.PONYTAIL_DEFAULT_MODE;
  return {
    ...base,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    XDG_CONFIG_HOME: path.join(home, 'config'),
    ...extra,
  };
}

function run(home, input, extra) {
  const result = spawnSync(process.execPath, [hook], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: env(home, extra),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  // JSON.parse on the full stdout fails if a second JSON object is appended.
  return JSON.parse(result.stdout);
}

function withState(home, fn) {
  const keys = ['CLAUDE_CONFIG_DIR', 'XDG_CONFIG_HOME', 'PONYTAIL_DEFAULT_MODE'];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, env(home));
  delete process.env.PONYTAIL_DEFAULT_MODE;
  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const event = (cwd) => ({ cwd, agentName: 'ponytail-reviewer', sessionId: 's1', timestamp: 1 });

test('returns lite instructions for a lite workspace', (t) => {
  const home = tempHome(t);
  const workspace = path.join(home, 'repo');
  withState(home, () => writeMode('lite', workspace));
  assert.deepEqual(run(home, event(workspace)), { additionalContext: getPonytailInstructions('lite') });
});

test('returns {} when the workspace mode is off', (t) => {
  const home = tempHome(t);
  const workspace = path.join(home, 'repo');
  withState(home, () => writeMode('off', workspace));
  assert.deepEqual(run(home, event(workspace)), {});
});

test('uses the configured default without persisting it', (t) => {
  const home = tempHome(t);
  const workspace = path.join(home, 'repo');
  const out = run(home, event(workspace), { PONYTAIL_DEFAULT_MODE: 'ultra' });
  assert.deepEqual(out, { additionalContext: getPonytailInstructions('ultra') });
  assert.equal(fs.existsSync(path.join(home, '.claude')), false);
});

test('returns {} for malformed or incomplete input', (t) => {
  const home = tempHome(t);
  assert.deepEqual(run(home, '{not json'), {});
  assert.deepEqual(run(home, ''), {});
  assert.deepEqual(run(home, { agentName: 'ponytail-reviewer' }), {});
  assert.deepEqual(run(home, { cwd: home }), {});
});
