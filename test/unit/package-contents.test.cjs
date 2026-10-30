const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const YAML = require('yaml');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('package manifest contributes the expected VS Code resources', () => {
  const manifest = JSON.parse(read('package.json'));

  assert.equal(manifest.main, './dist/extension.js');
  assert.equal(manifest.contributes.chatSkills.length, 6);
  assert.equal(manifest.contributes.chatInstructions.length, 3);
  assert.equal(manifest.contributes.chatAgents.length, 2);
  assert.deepEqual(manifest.contributes.commands.map(({ command }) => command), ['ponytail.setMode']);
  for (const { path: file } of [
    ...manifest.contributes.chatSkills,
    ...manifest.contributes.chatInstructions,
    ...manifest.contributes.chatAgents,
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
  }
});

test('extension docs identify and mirror the pinned upstream project', () => {
  const manifest = JSON.parse(read('package.json'));
  const pin = JSON.parse(read('upstream.json'));
  const readme = read('README.md');

  assert.equal(manifest.homepage, 'https://github.com/DietrichGebert/ponytail');
  assert.match(readme, /https:\/\/github\.com\/DietrichGebert\/ponytail/);
  assert.match(readme, /7801d061243d7b753bad0e0b3c057cd250b11755/);
  assert.match(readme, /https:\/\/github\.com\/DietrichGebert\/ponytail\/blob\/7801d061243d7b753bad0e0b3c057cd250b11755\/README\.md/);
  assert.doesNotMatch(readme, /\]\(UPSTREAM-README\.md\)/);
  assert.match(readme, /UPSTREAM-README\.md/);
  assert.ok(pin.assets.some(({ source, destination }) => source === 'README.md' && destination === 'UPSTREAM-README.md'));
  assert.match(read('UPSTREAM-README.md'), /<h1 align="center">Ponytail<\/h1>/);
});

test('packaged core skill disables automatic model invocation', () => {
  assert.match(read('skills/ponytail/SKILL.md'), /^disable-model-invocation:\s*true$/m);
});

test('each generated instruction explains the VS Code mode controls', () => {
  for (const mode of ['lite', 'full', 'ultra']) {
    const instruction = read(`generated/instructions/ponytail-${mode}.instructions.md`);
    assert.match(instruction, /Ponytail status-bar item or `Ponytail: Set Mode`/);
    assert.match(instruction, /Invoking `\/ponytail lite`, `\/ponytail full`, or `\/ponytail ultra` does not change extension state\./);
  }
});

test('VSIX ignore rules exclude development content but keep runtime and plugin files', () => {
  const ignored = new Set(read('.vscodeignore').split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  for (const file of [
    'upstream/**', 'scripts/**', '.superpowers/**', '.vscode/**', '.vscode-test/**',
    'out/**', 'test/**', 'src/**', 'node_modules/**', '.github/workflows/**',
    'docs/**', 'package-lock.json', 'tsconfig.json', 'esbuild.mjs',
  ]) {
    assert.ok(ignored.has(file), `${file} must be excluded from the VSIX`);
  }
  for (const file of [
    'shared/**', 'hooks/**', 'skills/**', 'generated/**',
    'com.github.copilot/**', 'README.md', 'LICENSE',
  ]) {
    assert.ok(!ignored.has(file), `${file} must remain eligible for the VSIX`);
  }
  assert.ok(!ignored.has('dist/**'), 'dist/** must remain eligible for the VSIX');
});

test('VSCE selects runtime and plugin files but excludes development and raw upstream content', () => {
  const cliPath = path.join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
  const listing = execFileSync(process.execPath, [cliPath, 'ls'], { cwd: root, encoding: 'utf8' });
  const files = new Set(listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));

  for (const file of [
    'LICENSE', 'README.md', 'shared/mode-state.cjs',
    'hooks/ponytail-config.js', 'hooks/ponytail-instructions.js',
    'UPSTREAM-README.md',
    'skills/ponytail/SKILL.md', 'generated/instructions/ponytail-full.instructions.md',
    'com.github.copilot/hooks/subagent-start.cjs',
    'com.github.copilot/agents/ponytail-reviewer.agent.md',
  ]) {
    assert.ok(files.has(file), `${file} must be selected for the VSIX`);
  }
  for (const file of [
    'test/unit/package-contents.test.cjs', 'src/extension.ts',
    'scripts/prepare-skills.cjs', 'upstream/skills/ponytail/SKILL.md',
  ]) {
    assert.ok(!files.has(file), `${file} must not be selected for the VSIX`);
  }
});

test('.gitignore excludes generated superpowers state', () => {
  const ignored = read('.gitignore').split(/\r?\n/).map((line) => line.trim());
  assert.ok(ignored.includes('.superpowers/'));
});

test('plugin hook commands resolve to files in the plugin source', () => {
  const hooks = JSON.parse(read('com.github.copilot/hooks/hooks.json')).hooks;
  for (const entries of Object.values(hooks)) {
    for (const { command } of entries) {
      const match = /\$\{PLUGIN_ROOT\}\/([^"\s]+)/.exec(command);
      assert.ok(match, `${command} must use a plugin-root path`);
      assert.ok(fs.existsSync(path.join(root, match[1])), `${match[1]} must exist`);
    }
  }
});

test('upstream updater opens a review PR without publishing or merging', () => {
  const workflow = YAML.parse(read('.github/workflows/upstream-update.yml'));
  const steps = Object.values(workflow.jobs).flatMap(({ steps = [] }) => steps);
  const actions = steps.flatMap(({ uses, run }) => [uses, run].filter(Boolean)).join('\n');

  assert.doesNotMatch(actions, /^\s*uses:\s*[^\n]*(?:publish|merge)/im);
  assert.doesNotMatch(actions, /\b(?:npm|vsce)\s+publish\b|\bgh\s+pr\s+merge\b|\bgit\s+merge\b/i);
  assert.match(actions, /git add[^\n]*UPSTREAM-README\.md/);
});

test('extension CI waits for unit tests and packages the compiled output after extension tests', () => {
  const workflow = YAML.parse(read('.github/workflows/ci.yml'));
  const unitSteps = workflow.jobs['unit-tests'].steps.map(({ run }) => run).filter(Boolean);
  const job = workflow.jobs['extension-tests'];
  const steps = job.steps.map(({ run }) => run).filter(Boolean);
  const pluginCommands = unitSteps.filter((run) => run.includes('check:plugin'));
  const pluginCheckIndex = unitSteps.indexOf('npm run check:plugin');
  const unitTestIndex = unitSteps.indexOf('npm run test:unit');
  const extensionTestIndex = steps.indexOf('npm run test:extension');
  const packageIndex = steps.indexOf('npm exec -- vsce package --allow-missing-repository');
  const packageCommands = steps.filter((run) => run.includes('vsce package'));

  assert.ok([].concat(job.needs || []).includes('unit-tests'));
  assert.deepEqual(pluginCommands, ['npm run check:plugin'], 'unit-tests must run the plugin check exactly once as a standalone command');
  assert.ok(pluginCheckIndex >= 0, 'unit-tests must run the plugin check');
  assert.ok(unitTestIndex > pluginCheckIndex, 'the plugin check must run before unit tests');
  assert.ok(!steps.some((run) => run.includes('check:plugin')), 'extension-tests must not repeat the plugin check');
  assert.ok(extensionTestIndex >= 0, 'extension-tests must run the extension tests');
  assert.deepEqual(packageCommands, ['npm exec -- vsce package --allow-missing-repository'], 'extension-tests must run exactly one standalone VSIX packaging command');
  assert.ok(packageIndex > extensionTestIndex, 'packaging must happen after extension tests');
  assert.ok(!steps.some((run) => /\bnpm\s+run\s+package(?::[\w-]+)?(?:\s|$)/.test(run)), 'CI must not invoke a package script in extension-tests');
  assert.ok(!steps.some((run) => /\bnpm\s+run\s+compile(?::[\w-]+)?(?:\s|$)/.test(run)), 'CI must not add a separate compile step in extension-tests');
});