const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { prepareSkill } = require('../../scripts/prepare-skills.cjs');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('an upstream control change or duplicate stops adaptation instead of silently changing behavior', () => {
  const raw = read('upstream/skills/ponytail/SKILL.md');
  assert.throws(() => prepareSkill('ponytail', raw.replace('Active for the whole session', 'A new activation contract')), /control paragraph changed/);
  assert.throws(() => prepareSkill('ponytail', raw + raw), /control paragraph changed/);
});

test('packaged core preserves coding rules but replaces unsupported session controls', () => {
  const core = read('skills/ponytail/SKILL.md');
  const raw = read('upstream/skills/ponytail/SKILL.md');
  assert.doesNotMatch(core, /Active for the whole session|Switch level:|argument-hint:/);
  assert.match(core, /Ponytail: Set Mode/);
  assert.match(core, /general-purpose/);
  assert.equal(core.slice(core.indexOf('## Before you write')), raw.slice(raw.indexOf('## Before you write')));
});

test('help describes persistent VS Code controls without Claude-only update commands', () => {
  const help = read('skills/ponytail-help/SKILL.md');
  assert.match(help, /Ponytail: Set Mode/);
  assert.match(help, /Install from VSIX/);
  assert.doesNotMatch(help, /\/plugin|\/reload-plugins|\/ponytail off|\/ponytail band/);
});

test('all generated modes and injected subagent guidance use the same host controls', () => {
  for (const mode of ['lite', 'full', 'ultra']) {
    const generated = read(`generated/instructions/ponytail-${mode}.instructions.md`);
    const hook = spawnSync(process.execPath, [path.join(root, 'com.github.copilot/hooks/subagent-start.cjs')], {
      input: JSON.stringify({ cwd: path.join(root, 'test-no-mode-saved'), agentName: 'ponytail-reviewer' }),
      encoding: 'utf8', env: { ...process.env, PONYTAIL_DEFAULT_MODE: mode },
    });
    assert.equal(hook.status, 0, hook.stderr);
    const injected = JSON.parse(hook.stdout).additionalContext;
    for (const content of [generated, injected]) {
      assert.match(content, /Ponytail: Set Mode/);
      assert.match(content, /general-purpose/);
      assert.doesNotMatch(content, /Active for the whole session|Switch level:/);
    }
    assert.ok(generated.includes(injected.trimEnd()));
  }
});
