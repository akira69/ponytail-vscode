const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const repository = 'https://github.com/DietrichGebert/ponytail.git';
const coreSkillNames = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];
const body = (content) => content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const node = (script, args = [], options = {}) =>
  spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { encoding: 'utf8', ...options });
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('upstream pin is the approved release and commit', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.json'), 'utf8'));
  assert.equal(pin.release, 'v5.3.3');
  assert.equal(pin.commit, '7801d061243d7b753bad0e0b3c057cd250b11755');
  assert.equal(pin.repository, repository);
  assert.deepEqual(Object.keys(pin.assetSha256).sort(), pin.assets.map((asset) => asset.destination).sort());
  for (const asset of pin.assets) {
    assert.equal(pin.assetSha256[asset.destination], sha256(path.join(root, asset.destination)));
  }
});

test('every upstream skill folder matches its SKILL.md name', () => {
  for (const name of coreSkillNames) {
    const skill = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(skill, new RegExp(`name:\\s*${name}\\b`));
  }
});

test('the core skill keeps upstream body and disables model auto-invocation', () => {
  const raw = fs.readFileSync(path.join(root, 'upstream/skills/ponytail/SKILL.md'), 'utf8');
  const packaged = fs.readFileSync(path.join(root, 'skills/ponytail/SKILL.md'), 'utf8');
  assert.match(packaged, /^disable-model-invocation:\s*true$/m);
  assert.equal(body(packaged), body(raw));
});

test('the full MIT license is bundled', () => {
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) \d{4} DietrichGebert/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test('check-upstream passes on the committed tree', () => {
  const result = node('check-upstream.cjs');
  assert.equal(result.status, 0, result.stderr);
});

test('generate-instructions writes exactly three deterministic mode files', () => {
  const outputDir = path.join(root, 'generated/instructions');
  const result = node('generate-instructions.cjs');
  assert.equal(result.status, 0, result.stderr);
  const files = fs.readdirSync(outputDir).sort();
  assert.deepEqual(files, ['ponytail-full.instructions.md', 'ponytail-lite.instructions.md', 'ponytail-ultra.instructions.md']);
  const { getPonytailInstructions } = require('../../hooks/ponytail-instructions.js');
  const first = {};
  for (const mode of ['lite', 'full', 'ultra']) {
    const content = fs.readFileSync(path.join(outputDir, `ponytail-${mode}.instructions.md`), 'utf8');
    first[mode] = content;
    assert.match(content, new RegExp(`^---\\nname: ponytail-${mode}\\n`));
    assert.match(content, /applyTo: "\*\*"/);
    assert.match(content, /Ponytail: Set Mode/);
    assert.ok(content.includes(getPonytailInstructions(mode)));
    assert.ok(content.endsWith('\n'));
    assert.ok(!content.endsWith('\n\n'));
  }
  assert.notEqual(first.lite, first.full);
  assert.notEqual(first.full, first.ultra);
  node('generate-instructions.cjs');
  for (const mode of ['lite', 'full', 'ultra']) {
    assert.equal(fs.readFileSync(path.join(outputDir, `ponytail-${mode}.instructions.md`), 'utf8'), first[mode]);
  }
});

function makeFakeUpstream(dir, { extra = {}, tag = 'v9.9.9', symlinkSource } = {}) {
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.json'), 'utf8'));
  for (const asset of pin.assets) {
    const target = path.join(dir, asset.source);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, asset.destination), target);
  }
  fs.writeFileSync(path.join(dir, 'not-whitelisted.txt'), 'must not be copied');
  for (const [name, content] of Object.entries(extra)) fs.writeFileSync(path.join(dir, name), content);
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('remote', 'add', 'origin', repository);
  git('add', '-A');
  if (symlinkSource) {
    const blob = execFileSync('git', ['-C', dir, 'hash-object', '-w', '--stdin'], { encoding: 'utf8', input: '../elsewhere' }).trim();
    git('update-index', '--add', '--cacheinfo', `120000,${blob},${symlinkSource}`);
  }
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fake');
  if (tag) git('tag', tag);
  return git('rev-parse', 'HEAD');
}

function withTemp(prefix, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    const source = path.join(tmp, 's');
    const destination = path.join(tmp, 'd');
    fs.mkdirSync(source);
    fs.mkdirSync(destination);
    return fn({ tmp, source, destination });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const sync = (source, destination, commit, extra = []) =>
  node('sync-upstream.cjs', ['--source', source, '--release', 'v9.9.9', '--commit', commit, '--destination', destination, ...extra]);
const pinned = () => JSON.parse(fs.readFileSync(path.join(root, 'upstream.json'), 'utf8'));

function trySymlink(target, link, type) {
  try {
    fs.symlinkSync(target, link, type);
    return true;
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') return false;
    throw error;
  }
}
const dirLinkType = process.platform === 'win32' ? 'junction' : 'dir';

test('sync-upstream rejects a tag that does not point at the requested commit', () => {
  withTemp('pt-sync-', ({ source, destination }) => {
    makeFakeUpstream(source);
    fs.writeFileSync(path.join(source, 'LICENSE'), 'second');
    execFileSync('git', ['-C', source, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-am', 'second']);
    const head = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const result = sync(source, destination, head);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /tag/i);
    assert.deepEqual(fs.readdirSync(destination), []);
  });
});

test('sync-upstream rejects a missing release tag', () => {
  withTemp('pt-sync-', ({ source, destination }) => {
    const commit = makeFakeUpstream(source, { tag: null });
    const result = sync(source, destination, commit);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /tag/i);
    assert.deepEqual(fs.readdirSync(destination), []);
  });
});

test('sync-upstream copies committed bytes, not modified or assume-unchanged worktree files', () => {
  withTemp('pt-sync-', ({ source, destination }) => {
    const commit = makeFakeUpstream(source);
    execFileSync('git', ['-C', source, 'update-index', '--assume-unchanged', 'hooks/ponytail-config.js']);
    fs.writeFileSync(path.join(source, 'hooks/ponytail-config.js'), 'tampered hidden');
    fs.writeFileSync(path.join(source, 'skills/ponytail/SKILL.md'), 'tampered dirty');
    const result = sync(source, destination, commit);
    assert.equal(result.status, 0, result.stderr);
    for (const asset of pinned().assets) {
      assert.deepEqual(fs.readFileSync(path.join(destination, asset.destination)), fs.readFileSync(path.join(root, asset.destination)), asset.destination);
    }
  });
});

test('sync-upstream rejects a source asset committed as a symlink', () => {
  withTemp('pt-sync-', ({ source, destination }) => {
    const commit = makeFakeUpstream(source, { symlinkSource: 'hooks/ponytail-config.js' });
    const result = sync(source, destination, commit);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /regular|symlink|mode/i);
    assert.deepEqual(fs.readdirSync(destination), []);
  });
});

test('sync-upstream rejects a symlinked destination parent before writing anything', (t) => {
  withTemp('pt-sync-', ({ tmp, source, destination }) => {
    const commit = makeFakeUpstream(source);
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    if (!trySymlink(outside, path.join(destination, 'hooks'), dirLinkType)) return t.skip('OS denied creating directory symlinks');
    fs.writeFileSync(path.join(destination, 'LICENSE'), 'sentinel');
    const result = sync(source, destination, commit);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink/i);
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.equal(fs.readFileSync(path.join(destination, 'LICENSE'), 'utf8'), 'sentinel');
    assert.ok(!fs.existsSync(path.join(destination, 'upstream.json')));
    assert.ok(!fs.existsSync(path.join(destination, 'skills')));
  });
});

test('sync-upstream rejects a symlinked destination root', (t) => {
  withTemp('pt-sync-', ({ tmp, source, destination }) => {
    const commit = makeFakeUpstream(source);
    const link = path.join(tmp, 'link');
    if (!trySymlink(destination, link, dirLinkType)) return t.skip('OS denied creating directory symlinks');
    const result = sync(source, link, commit);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink/i);
    assert.deepEqual(fs.readdirSync(destination), []);
  });
});

test('sync-upstream rejects an existing destination file that is a symlink', (t) => {
  withTemp('pt-sync-', ({ tmp, source, destination }) => {
    const commit = makeFakeUpstream(source);
    const outside = path.join(tmp, 'outside.txt');
    fs.writeFileSync(outside, 'sentinel');
    if (!trySymlink(outside, path.join(destination, 'LICENSE'), 'file')) return t.skip('OS denied creating file symlinks');
    const result = sync(source, destination, commit);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink/i);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'sentinel');
  });
});

test('sync-upstream accepts an in-root destination named ..cache but rejects traversal', () => {
  withTemp('pt-sync-', ({ source, destination }) => {
    const commit = makeFakeUpstream(source);
    const pin = pinned();
    const write = (value) => {
      const manifest = path.join(destination, '..', 'manifest.json');
      const assets = pin.assets.map((asset) => ({ ...asset }));
      assets[0].destination = value;
      fs.writeFileSync(manifest, JSON.stringify({ ...pin, assets }));
      return sync(source, destination, commit, ['--manifest', manifest]);
    };
    const bad = write('..\\outside.txt');
    assert.notEqual(bad.status, 0);
    assert.deepEqual(fs.readdirSync(destination), []);
    const ok = write('..cache/LICENSE');
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(fs.existsSync(path.join(destination, '..cache', 'LICENSE')));
  });
});

function checkCopy(tmp) {
  const copy = path.join(tmp, 'ext');
  for (const dir of ['scripts', 'upstream', 'skills', 'hooks']) fs.cpSync(path.join(root, dir), path.join(copy, dir), { recursive: true });
  for (const file of ['upstream.json', 'LICENSE']) fs.copyFileSync(path.join(root, file), path.join(copy, file));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(copy, 'node_modules'), 'junction');
  return copy;
}

test('check-upstream rejects malformed manifest paths without reading outside the root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-check-'));
  try {
    const copy = checkCopy(tmp);
    const outside = path.join(tmp, 'outside.txt');
    fs.writeFileSync(outside, 'outside');
    const outsideSha = sha256(outside);
    const pin = pinned();
    const cases = [
      ['traversal', (assets, sha) => { sha['../outside.txt'] = outsideSha; assets[0].destination = '../outside.txt'; }, /escape|invalid/i],
      ['absolute', (assets, sha) => { sha[outside] = outsideSha; assets[0].destination = outside; }, /escape|invalid/i],
      ['empty', (assets) => { assets[0].destination = ''; }, /invalid|empty/i],
      ['duplicate', (assets) => { assets[1].destination = assets[0].destination; }, /duplicate/i],
    ];
    for (const [name, mutate, pattern] of cases) {
      const assets = pin.assets.map((asset) => ({ ...asset }));
      const assetSha256 = { ...pin.assetSha256 };
      if (name === 'traversal' || name === 'absolute') delete assetSha256[pin.assets[0].destination];
      mutate(assets, assetSha256);
      fs.writeFileSync(path.join(copy, 'upstream.json'), JSON.stringify({ ...pin, assets, assetSha256 }));
      const result = spawnSync(process.execPath, [path.join(copy, 'scripts/check-upstream.cjs')], { encoding: 'utf8' });
      assert.notEqual(result.status, 0, name);
      assert.match(result.stderr, pattern, name);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('sync-upstream copies only whitelisted assets and records hashes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-sync-'));
  try {
    const source = path.join(tmp, 's');
    const destination = path.join(tmp, 'd');
    fs.mkdirSync(source);
    fs.mkdirSync(destination);
    const commit = makeFakeUpstream(source);
    const result = node('sync-upstream.cjs', ['--source', source, '--release', 'v9.9.9', '--commit', commit, '--destination', destination]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(destination, 'upstream/skills/ponytail/SKILL.md')));
    assert.ok(!fs.existsSync(path.join(destination, 'not-whitelisted.txt')));
    const pin = JSON.parse(fs.readFileSync(path.join(destination, 'upstream.json'), 'utf8'));
    assert.equal(pin.release, 'v9.9.9');
    assert.equal(pin.commit, commit);
    for (const asset of pin.assets) assert.equal(pin.assetSha256[asset.destination], sha256(path.join(destination, asset.destination)));
    const rootPin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.json'), 'utf8'));
    assert.equal(rootPin.release, pinned().release);
    assert.equal(rootPin.commit, pinned().commit);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('sync-upstream rejects a wrong commit, wrong origin, and path escapes without writing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-sync-'));
  try {
    const source = path.join(tmp, 's');
    const destination = path.join(tmp, 'd');
    fs.mkdirSync(source);
    fs.mkdirSync(destination);
    const commit = makeFakeUpstream(source);
    const bad = node('sync-upstream.cjs', ['--source', source, '--release', 'v9.9.9', '--commit', 'a'.repeat(40), '--destination', destination]);
    assert.notEqual(bad.status, 0);
    execFileSync('git', ['-C', source, 'remote', 'set-url', 'origin', 'https://example.com/other.git']);
    const origin = node('sync-upstream.cjs', ['--source', source, '--release', 'v9.9.9', '--commit', commit, '--destination', destination]);
    assert.notEqual(origin.status, 0);
    execFileSync('git', ['-C', source, 'remote', 'set-url', 'origin', repository]);

    const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.json'), 'utf8'));
    for (const [field, value] of [['source', '../outside.txt'], ['destination', '../outside.txt'], ['destination', path.resolve(tmp, 'abs.txt')]]) {
      const manifest = path.join(tmp, 'manifest.json');
      const assets = pin.assets.map((asset) => ({ ...asset }));
      assets[0][field] = value;
      fs.writeFileSync(manifest, JSON.stringify({ ...pin, assets }));
      const result = node('sync-upstream.cjs', ['--source', source, '--release', 'v9.9.9', '--commit', commit, '--destination', destination, '--manifest', manifest]);
      assert.notEqual(result.status, 0, `${field}=${value}`);
    }
    assert.deepEqual(fs.readdirSync(destination), []);
    assert.ok(!fs.existsSync(path.join(tmp, 'outside.txt')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('check-upstream fails when a hashed asset is modified', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-check-'));
  try {
    const copy = path.join(tmp, 'ext');
    for (const dir of ['scripts', 'upstream', 'skills', 'hooks']) fs.cpSync(path.join(root, dir), path.join(copy, dir), { recursive: true });
    for (const file of ['upstream.json', 'LICENSE', 'UPSTREAM-README.md']) fs.copyFileSync(path.join(root, file), path.join(copy, file));
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(copy, 'node_modules'), 'junction');
    const run = () => spawnSync(process.execPath, [path.join(copy, 'scripts/check-upstream.cjs')], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    fs.appendFileSync(path.join(copy, 'skills/ponytail-help/SKILL.md'), '\ntampered\n');
    assert.notEqual(run().status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('upstream-update workflow only opens a reviewable PR after full validation', () => {
  const YAML = require('yaml');
  const workflow = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows/upstream-update.yml'), 'utf8'));
  assert.ok('schedule' in workflow.on);
  assert.ok('workflow_dispatch' in workflow.on);
  assert.deepEqual(workflow.permissions, { contents: 'write', 'pull-requests': 'write' });
  const steps = workflow.jobs.update.steps;
  const actionRefPattern = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+@[0-9a-f]{40}$/;
  assert.doesNotMatch(`actions:evil/checkout@${'a'.repeat(40)}`, actionRefPattern, 'action owners must use valid GitHub characters');
  assert.ok(steps.filter((step) => 'uses' in step).every((step) => actionRefPattern.test(step.uses)), 'every workflow action must be pinned to an immutable commit SHA');
  assert.match(steps[0].uses, /^actions\/checkout@[0-9a-f]{40}$/);
  assert.equal(steps[0].with.ref, '${{ github.event.repository.default_branch }}');
  assert.equal(steps[0].with['persist-credentials'], false);
  const index = (pattern) => steps.findIndex((step) => pattern.test(step.run || ''));
  const resolve = steps[index(/releases\/latest/)];
  assert.match(resolve.run, /git -C "\$source" checkout --detach "\$commit"/);
  assert.ok(resolve.run.indexOf('fetch --depth=1') < resolve.run.indexOf('checkout --detach'));
  const order = [/scripts\/sync-upstream\.cjs/, /^npm ci$/m, /^npm run prepare:skills$/m, /^npm run generate:instructions$/m, /^npm run check:upstream$/m, /^npm run check:plugin$/m, /^npm test$/m, /^npm run package$/m, /gh pr create/].map(index);
  assert.ok(order.every((at) => at >= 0), String(order));
  assert.ok(order.every((at, i) => i === 0 || at > order[i - 1]), `steps not strictly ordered: ${order}`);
  assert.ok(steps[order[0]].run.includes('--commit'));
  const pr = steps[order[order.length - 1]].run;
  const at = (pattern) => pr.search(pattern);
  const positions = [/gh auth setup-git/, /gh pr list[^\n]*--state open/, /git ls-remote --exit-code --heads origin/, /git push origin/, /gh pr create/].map(at);
  assert.ok(positions.every((p) => p >= 0), String(positions));
  assert.ok(positions.every((p, i) => i === 0 || p > positions[i - 1]), `PR step not ordered: ${positions}`);
  assert.match(pr, /\bexit 0\b/);
  assert.match(pr, /exit 1/);
  assert.match(pr, /already exists[\s\S]*no open pull request|no open pull request[\s\S]*already exists/i);
  assert.doesNotMatch(pr, /--force|--force-with-lease|\s-f\s|\+HEAD|\bgit push[^\n]*\+/);
  assert.match(pr, /does not trigger/i);
  assert.match(pr, /close and reopen/i);
  assert.doesNotMatch(pr, /CI (will|should) (run|start)|triggers? (CI|workflows)(?! )|automatically (run|trigger)/i);
  assert.ok(!steps.slice(0, order[order.length - 1]).some((step) => /gh auth setup-git|git push/.test(step.run || '')));
  const text = steps.map((step) => `${step.uses || ''}\n${step.run || ''}`).join('\n');
  assert.doesNotMatch(text, /gh pr merge|vsce publish|gh release|action-gh-release|marketplace/i);
  assert.doesNotMatch(text, /--ready|auto-merge/i);
});
