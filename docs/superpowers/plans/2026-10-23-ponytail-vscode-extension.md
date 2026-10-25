# Ponytail VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a native VS Code extension and companion Copilot Agent Plugin based on Ponytail v5.3.2, with offline skills, mode-aware subagent guidance, reviewable upstream updates, and documented manual release.

**Architecture:** One repository root is both the VS Code extension package and the Agent Plugins package. Root `skills/` and upstream hook helpers are the canonical vendored assets; the extension and plugin reference those same files. One small Node module owns the mode-state file contract shared by the extension and plugin hooks.

**Tech Stack:** TypeScript extension host, Node.js 22, VS Code 1.142.0+, esbuild, `@vscode/test-electron`, Mocha, Node `node:test`, `@vscode/vsce`, GitHub Actions.

**Spec:** [2026-10-23-ponytail-vscode-extension-design.md](../specs/2026-10-23-ponytail-vscode-extension-design.md)

## Global Constraints

- Upstream baseline: Ponytail v5.3.2, commit `16352ac229eb08a9598dcae48fe9f2b342567d86`.
- The upstream repository is the source of truth; never use or modify the installed `Volvo-AntoniaCanizares.ponytail-vscode` package as source.
- Package required instruction and skill assets locally so normal use works offline.
- Preserve and distribute the complete upstream MIT license and attribution.
- Preserve `.vscode/settings.json`; do not initialize Git or commit because this workspace is not currently a Git repository.
- Upstream updates may open a PR, but must never merge it or publish either artifact.
- Copilot hooks are Preview. The built-in `general-purpose` agent does not emit `subagentStart`; hook injection guides behavior but cannot enforce it.
- Do not implement the Claude Code-only band, board, or session import.

## Review Focus

- Invalid, BOM-prefixed, or malformed Ponytail config must fall back to a valid default without preventing extension activation; test invalid config and `PONYTAIL_DEFAULT_MODE` precedence in Task 3.
- A workspace-specific level must not leak into another workspace, and Windows paths must produce stable keys; test two roots and a Windows-style path in Task 3.
- Malformed or incomplete `subagentStart` payloads must return valid no-op JSON and must not block delegation; test malformed JSON, missing `cwd`, and missing `agentName` in Task 4.
- `off` must suppress main-chat instructions, subagent injection, and automatic loading of the core skill while leaving `/ponytail` explicitly invocable; test the metadata overlay in Task 2 and the full behavior in Task 8.
- An upstream release tag or archive must not write outside the allow-listed asset paths, trigger duplicate unsafe updates, or auto-merge; test the sync script with a temporary source fixture and inspect the workflow permissions in Task 6.

---

## File Structure

The workspace currently contains only `.vscode/settings.json`, `.vscode/excel-pq-symbols/excel-pq-symbols.json`, and the approved design spec. Do not modify either existing VS Code settings/data file.

- `package.json`: extension manifest, supported engine floor, contributions, scripts, and development dependencies.
- `.gitattributes`: enforce LF for tracked text so SHA-256 asset verification is stable across Windows and Linux.
- `tsconfig.json`, `esbuild.mjs`, `.vscodeignore`, `.gitignore`: compile and package only the intended extension/plugin assets.
- `src/extension.ts`: extension activation, mode picker, status-bar item, and context-key updates.
- `shared/mode-state.cjs`: platform-aware active-mode state shared by extension and plugin hooks.
- `test/unit/mode-state.test.cjs`: isolated tests for the filesystem contract and mode validation.
- `test/runTest.cjs`, `test/suite/index.ts`, `test/suite/extension.test.ts`, `test/suite/mode.test.ts`: isolated VS Code extension-host runner and command/state integration checks.
- `upstream/skills/ponytail/SKILL.md`: raw, hash-checked upstream core skill source retained in the repository but excluded from VSIX packaging. `skills/ponytail/SKILL.md` is generated with only `disable-model-invocation: true` added to its frontmatter; the Markdown body remains byte-for-byte identical so `off` suppresses automatic loading while `/ponytail` remains user-invocable.
- `skills/ponytail-review/`, `skills/ponytail-audit/`, `skills/ponytail-debt/`, `skills/ponytail-gain/`, `skills/ponytail-help/`: exact skill assets copied from the pinned upstream commit.
- `hooks/ponytail-config.js`, `hooks/ponytail-instructions.js`: upstream helpers copied without extension-specific edits; retain their relative layout with `skills/`.
- `generated/instructions/ponytail-{lite,full,ultra}.instructions.md`: deterministic mode-filtered files generated from the upstream instruction builder.
- `upstream.json`: pinned upstream release and commit plus the explicit import file list.
- `scripts/sync-upstream.cjs`, `scripts/check-upstream.cjs`, `scripts/prepare-skills.cjs`, `scripts/generate-instructions.cjs`: whitelist-only asset sync, source/version verification, core-skill metadata overlay, and offline instruction generation.
- `plugin.json`: Agent Plugins 1.0 metadata at repository root.
- `com.github.copilot/hooks/hooks.json`: Copilot `subagentStart` hook registration.
- `com.github.copilot/hooks/subagent-start.cjs`: hook adapter using the shared state module and upstream instruction builder.
- `com.github.copilot/agents/ponytail-reviewer.agent.md`, `com.github.copilot/agents/ponytail-researcher.agent.md`: focused custom agents, restricted to verified read/search tool aliases.
- `scripts/check-plugin.cjs`: offline validation of plugin manifest, paths, and skill frontmatter.
- `.github/workflows/ci.yml`: build, unit/extension tests, plugin checks, and VSIX packaging on pushes and PRs.
- `.github/workflows/upstream-update.yml`: scheduled/manual upstream check that opens a PR only.
- `README.md`, `THIRD-PARTY-NOTICES.md`: setup, capabilities/limits, update process, tests, and manual release instructions.

## Task 1: Scaffold the Extension and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.mjs`
- Create: `.vscodeignore`
- Create: `.gitignore`
- Create: `src/extension.ts`
- Create: `test/runTest.cjs`
- Create: `test/suite/index.ts`
- Create: `test/suite/extension.test.ts`
- Create: `test/unit/scaffold.test.cjs`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces extension identifier `ponytail-vscode.ponytail-vscode`, extension entry point `./dist/extension.js`, command ID `ponytail.setMode`, and scripts `typecheck`, `compile`, `compile:tests`, `test:unit`, `test:extension`, `test`, and `package`.
- Use Node 22 and VS Code engine floor `^1.142.0` for the first supported baseline. Use `node:test` for pure Node code and Mocha under `@vscode/test-electron` for extension-host behavior.

- [ ] **Step 1: Write the extension-host smoke test**

Create `test/suite/extension.test.ts`:

```ts
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
suite('Ponytail extension', () => {
  test('activates and contributes the mode command', async () => {
    const extension = vscode.extensions.getExtension('ponytail-vscode.ponytail-vscode');
    assert.ok(extension);
    await extension.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('ponytail.setMode'));
  });
});
```

- [ ] **Step 2: Add the extension project and test harness**

Create `package.json` with these required fields and scripts; install the named development dependencies (`typescript`, `esbuild`, `@types/node`, `@types/vscode`, `mocha`, `@types/mocha`, `@vscode/test-electron`, and `@vscode/vsce`) using `npm install --save-dev`:

```json
{
  "name": "ponytail-vscode",
  "displayName": "Ponytail",
  "publisher": "ponytail-vscode",
  "version": "0.1.0",
  "description": "Ponytail for VS Code and GitHub Copilot",
  "license": "MIT",
  "engines": { "vscode": "^1.142.0" },
  "main": "./dist/extension.js",
  "activationEvents": ["onStartupFinished"],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "compile": "npm run typecheck && node esbuild.mjs",
    "test:unit": "node --test \"test/unit/**/*.cjs\"",
    "compile:tests": "node esbuild.mjs --tests",
    "test:extension": "npm run compile && npm run compile:tests && node test/runTest.cjs",
    "test": "npm run test:unit && npm run test:extension",
    "package": "npm run compile && vsce package"
  },
  "contributes": {
    "commands": [
      { "command": "ponytail.setMode", "title": "Ponytail: Set Mode", "category": "Ponytail" }
    ]
  }
}
```

Create `tsconfig.json` with `target: "ES2022"`, `module: "commonjs"`, `moduleResolution: "node"`, `strict: true`, `rootDir: "src"`, and `outDir: "dist"`. Create `esbuild.mjs` to bundle `src/extension.ts` to `dist/extension.js` with `platform: 'node'`, `format: 'cjs'`, `target: 'node22'`, `bundle: true`, and `external: ['vscode']`. When invoked with `--tests`, emit `test/suite/index.ts` as `out/test/suite/index.js` and every `test/suite/*.test.ts` as its matching `.js` file under `out/test/suite/`, keeping `vscode` external. The suite index configures Mocha with the TDD UI, loads `out/test/suite/extension.test.js`, and sets a failing process exit code when any test fails.

Create `test/runTest.cjs`:

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-vscode-test-'));
runTests({
  extensionDevelopmentPath: path.resolve(__dirname, '..'),
  extensionTestsPath: path.resolve(__dirname, '../out/test/suite/index.js'),
  extensionTestsEnv: {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(testHome, '.claude'),
    XDG_CONFIG_HOME: path.join(testHome, 'config'),
    PONYTAIL_DEFAULT_MODE: 'full',
  },
}).finally(() => fs.rmSync(testHome, { recursive: true, force: true })).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Create `test/suite/index.ts`:

```ts
import * as path from 'node:path';
import Mocha = require('mocha');

const mocha = new Mocha({ ui: 'tdd', color: true });
mocha.addFile(path.resolve(__dirname, 'extension.test.js'));
mocha.run((failures) => {
  process.exitCode = failures === 0 ? 0 : 1;
});
```

Create `src/extension.ts` with `activate(context: vscode.ExtensionContext): void` and `deactivate(): void`, but leave `activate` empty so the command test fails. Implement command registration only after that failure is confirmed.

Set `.vscodeignore` to exclude `src/**`, `test/**`, `node_modules/**`, `.github/workflows/**`, `docs/**`, and `upstream/**`; do not exclude `skills/**`, `hooks/**`, `shared/**`, `com.github.copilot/**`, `generated/**`, or `LICENSE`. Add generated build output and `node_modules` to `.gitignore`.

Create `test/unit/scaffold.test.cjs`:

```js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const manifest = require('../../package.json');

test('declares the Ponytail extension and test scripts', () => {
  assert.equal(manifest.name, 'ponytail-vscode');
  assert.equal(manifest.engines.vscode, '^1.142.0');
  assert.equal(typeof manifest.scripts.compile, 'string');
  assert.equal(typeof manifest.scripts.test, 'string');
});
```

Create `.github/workflows/ci.yml` for `push` and `pull_request`, with read-only repository permissions and Node 22. Add a unit-test job matrix for `ubuntu-latest` and `windows-latest`, each running `npm ci` and `npm run test:unit`; add an `ubuntu-latest` extension-host job running `npm ci` and `npm run test:extension`. Add plugin checks and VSIX packaging in the tasks that create those assets.
- [ ] **Step 3: Run the smoke test and verify it fails**

Run: `npm run test:extension`
Expected: FAIL because `src/extension.ts` does not register `ponytail.setMode`.

- [ ] **Step 4: Implement the minimum extension activation**

Create `src/extension.ts`:

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ponytail.setMode', async () => undefined),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 5: Run the extension test and verify it passes**

Run: `npm run test:extension`
Expected: PASS; the extension activates and `ponytail.setMode` appears in the command registry.

- [ ] **Step 6: Run the clean build and package checks**

Run: `npm run compile`
Expected: PASS with `dist/extension.js` emitted.

Do not add commit commands: this workspace is not a Git repository, and the design explicitly forbids initializing one without a separate request.

## Task 2: Import and Pin Upstream Assets

**Files:**
- Create: `upstream.json`
- Create: `.gitattributes`
- Create: `upstream/skills/ponytail/SKILL.md`
- Create: `skills/ponytail/SKILL.md`
- Create: `skills/ponytail-review/SKILL.md`
- Create: `skills/ponytail-audit/SKILL.md`
- Create: `skills/ponytail-debt/SKILL.md`
- Create: `skills/ponytail-gain/SKILL.md`
- Create: `skills/ponytail-help/SKILL.md`
- Create: `hooks/ponytail-config.js`
- Create: `hooks/ponytail-instructions.js`
- Create: `LICENSE`
- Create: `scripts/sync-upstream.cjs`
- Create: `scripts/check-upstream.cjs`
- Create: `scripts/prepare-skills.cjs`
- Create: `scripts/generate-instructions.cjs`
- Create: `test/unit/upstream.test.cjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- `scripts/sync-upstream.cjs --source "$env:TEMP\ponytail-upstream" --release v5.3.2 --commit 16352ac229eb08a9598dcae48fe9f2b342567d86 [--destination "$env:TEMP\ponytail-target"]` copies only files named in the repository `upstream.json`; destination defaults to the extension root, and tests use a temporary destination.
- `scripts/check-upstream.cjs` exits `0` only if the pin, required paths, skill frontmatter names, and upstream license are present.
- `scripts/generate-instructions.cjs` writes exactly three mode-filtered instruction files from upstream `getPonytailInstructions(mode)` and never fetches the network.
- `scripts/prepare-skills.cjs` adds only `disable-model-invocation: true` to the generated core skill frontmatter; its body is identical to `upstream/skills/ponytail/SKILL.md`.
- `scripts/generate-instructions.cjs` writes exactly three mode-filtered instruction files from upstream `getPonytailInstructions(mode)` and never fetches the network.

- [ ] **Step 1: Write upstream integrity tests**

Create `test/unit/upstream.test.cjs` with tests that assert:

```js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('upstream pin is the approved release and commit', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.json'), 'utf8'));
  assert.match(pin.release, /^v\d+\.\d+\.\d+$/);
  assert.match(pin.commit, /^[a-f0-9]{40}$/);
  assert.equal(pin.repository, 'https://github.com/DietrichGebert/ponytail.git');
  assert.deepEqual(Object.keys(pin.assetSha256).sort(), pin.assets.map((asset) => asset.destination).sort());
});

test('every upstream skill folder matches its SKILL.md name', () => {
  for (const name of ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
    const skill = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(skill, new RegExp(`name:\\s*${name}\\b`));
  }
});

test('the core skill keeps upstream body and disables model auto-invocation', () => {
  const raw = fs.readFileSync(path.join(root, 'upstream/skills/ponytail/SKILL.md'), 'utf8');
  const packaged = fs.readFileSync(path.join(root, 'skills/ponytail/SKILL.md'), 'utf8');
  const body = (content) => content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  assert.match(packaged, /^disable-model-invocation:\s*true$/m);
  assert.equal(body(packaged), body(raw));
});

test('the full MIT license is bundled', () => {
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) \d{4} DietrichGebert/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});
```

- [ ] **Step 2: Run upstream tests and verify they fail**

Run: `npm run test:unit`
Expected: FAIL because `upstream.json`, the skill tree, and `LICENSE` are not present.

- [ ] **Step 3: Import the exact pinned upstream source**

Create `upstream.json`:

```json
{
  "repository": "https://github.com/DietrichGebert/ponytail.git",
  "release": "v5.3.2",
  "commit": "16352ac229eb08a9598dcae48fe9f2b342567d86",
  "assets": [
    { "source": "LICENSE", "destination": "LICENSE" },
    { "source": "skills/ponytail/SKILL.md", "destination": "upstream/skills/ponytail/SKILL.md" },
    { "source": "skills/ponytail-review/SKILL.md", "destination": "skills/ponytail-review/SKILL.md" },
    { "source": "skills/ponytail-audit/SKILL.md", "destination": "skills/ponytail-audit/SKILL.md" },
    { "source": "skills/ponytail-debt/SKILL.md", "destination": "skills/ponytail-debt/SKILL.md" },
    { "source": "skills/ponytail-gain/SKILL.md", "destination": "skills/ponytail-gain/SKILL.md" },
    { "source": "skills/ponytail-help/SKILL.md", "destination": "skills/ponytail-help/SKILL.md" },
    { "source": "hooks/ponytail-config.js", "destination": "hooks/ponytail-config.js" },
    { "source": "hooks/ponytail-instructions.js", "destination": "hooks/ponytail-instructions.js" }
  ],
  "assetSha256": {}
}
```

Create `.gitattributes`:

```gitattributes
* text=auto eol=lf
```

This ensures the SHA-256 values remain stable when Git checks out the source on Windows and Linux.

Install the YAML parser used only by the asset-preparation script with `npm install --save-dev yaml`. Implement `scripts/prepare-skills.cjs`:

```js
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'upstream/skills/ponytail/SKILL.md');
const destination = path.join(root, 'skills/ponytail/SKILL.md');
const raw = fs.readFileSync(source, 'utf8');
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
if (!match) throw new Error('Upstream Ponytail skill has invalid frontmatter');
const metadata = YAML.parse(match[1]);
if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || metadata.name !== 'ponytail' || typeof metadata.description !== 'string') {
  throw new Error('Upstream Ponytail skill metadata is invalid');
}
metadata['disable-model-invocation'] = true;
const frontmatter = YAML.stringify(metadata).trimEnd();
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `---\n${frontmatter}\n---\n${match[2]}`, 'utf8');
```

`disable-model-invocation: true` keeps the core skill explicitly available as `/ponytail` while preventing automatic skill loading from bypassing the extension's `off` mode. Run `npm run prepare:skills` after import and before instruction generation.

Run `git clone --filter=blob:none --no-checkout https://github.com/DietrichGebert/ponytail.git "$env:TEMP\ponytail-upstream"` and fetch/checkout the pinned tag. Implement `scripts/sync-upstream.cjs` to verify the `origin`, resolve `refs/tags/<release>^{commit}` and require it to equal `--commit`, and verify the selected commit is the intended source revision. For each allow-listed asset, use `git ls-tree -z <commit> -- <source>` and accept only a regular blob mode (`100644` or `100755`); read its bytes with `git show <commit>:<source>` rather than from the working tree. Resolve source/destination paths beneath their roots, reject traversal and absolute paths, and reject any existing destination path component that is a symlink. Validate every asset before writing. Copy bytes, update `assetSha256` keyed by destination, then write `upstream.json`. Run `node scripts/sync-upstream.cjs --source "$env:TEMP\ponytail-upstream" --release v5.3.2 --commit 16352ac229eb08a9598dcae48fe9f2b342567d86` to import assets; then run `node scripts/prepare-skills.cjs` to generate the runtime core skill. Keep extension-owned Copilot hooks out of the upstream asset map.

Implement `scripts/check-upstream.cjs` to verify the manifest shape, 40-character commit, release tag, every raw upstream destination's SHA-256 against `assetSha256`, each skill folder/name match, the generated core skill's `disable-model-invocation: true` metadata and unchanged body, and required MIT license phrases. Implement `scripts/generate-instructions.cjs` with this loop:

```js
const fs = require('node:fs');
const path = require('node:path');
const { getPonytailInstructions } = require('../hooks/ponytail-instructions.js');

const outputDir = path.resolve(__dirname, '../generated/instructions');
fs.mkdirSync(outputDir, { recursive: true });
const hostNote = 'In VS Code, use the Ponytail status-bar item or `Ponytail: Set Mode` to change the persistent mode. Invoking `/ponytail lite`, `/ponytail full`, or `/ponytail ultra` does not change extension state.';
for (const mode of ['lite', 'full', 'ultra']) {
  const frontmatter = `---\nname: ponytail-${mode}\ndescription: Ponytail ${mode} coding guidance.\napplyTo: "**"\n---\n\n`;
  fs.writeFileSync(path.join(outputDir, `ponytail-${mode}.instructions.md`), frontmatter + hostNote + '\n\n' + getPonytailInstructions(mode) + '\n');
}
```

The generator is deterministic, uses only bundled inputs, and performs no network access.

- [ ] **Step 4: Add the integrity checks to the package scripts and run them**

Add `"prepare:skills": "node scripts/prepare-skills.cjs"`, `"check:upstream": "node scripts/check-upstream.cjs"`, and `"generate:instructions": "node scripts/generate-instructions.cjs"` to `package.json`. Install `yaml` as a development dependency. Run `npm run prepare:skills`, then `npm run check:upstream`, then `npm run generate:instructions`; invoke those scripts in that order before compile/package in CI.

Expected: all three commands PASS; generated files contain the correct mode-specific upstream guidance and the VS Code mode-control note, with no network access.

## Task 3: Implement the Shared Mode-State Contract

**Files:**
- Create: `shared/mode-state.cjs`
- Create: `test/unit/mode-state.test.cjs`

**Interfaces:**
- `readMode(workspaceRoot?)` returns `'off' | 'lite' | 'full' | 'ultra' | null`.
- `writeMode(mode, workspaceRoot?)` writes the active mode to the workspace-specific state file and the shared upstream-compatible state file.
- `getEffectiveMode(workspaceRoot?)` returns a valid active mode or calls the vendored upstream `getDefaultMode()`.

- [ ] **Step 1: Write mode-state tests**

Create `test/unit/mode-state.test.cjs` with isolated temporary paths and reliable process-environment restoration:

```js
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
```

The tests restore all mutated environment variables and remove each temporary home in `t.after`, even when an assertion fails. Run the same suite on Windows and Linux CI so the hash uses each platform's native `path.normalize` behavior.

- [ ] **Step 2: Run the focused mode-state test and verify it fails**

Run: `node --test test/unit/mode-state.test.cjs`
Expected: FAIL because `shared/mode-state.cjs` does not exist.

- [ ] **Step 3: Implement the shared state module**

Implement `shared/mode-state.cjs`:

```js
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getClaudeDir, getDefaultMode, normalizeMode } = require('../hooks/ponytail-config.js');

function sharedPath() {
  return path.join(getClaudeDir(), '.ponytail-active');
}

function workspacePath(workspaceRoot) {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim() === '') return null;
  const hash = crypto.createHash('sha256').update(path.normalize(workspaceRoot)).digest('hex');
  return path.join(getClaudeDir(), 'ponytail-modes', hash);
}

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

module.exports = { getEffectiveMode, readMode, writeMode };
```

`readMode(workspaceRoot)` deliberately reads only the hashed project file when a root is provided, matching upstream behavior rather than falling back to another workspace's shared flag. Tests mutate and restore `PONYTAIL_DEFAULT_MODE`, `XDG_CONFIG_HOME`, and `CLAUDE_CONFIG_DIR` because the upstream default resolver reads `process.env` directly.

- [ ] **Step 4: Run mode-state tests**

Run: `node --test test/unit/mode-state.test.cjs`
Expected: PASS for separate roots, no-workspace shared state, workspace isolation, invalid data, Windows paths, `off`, and upstream default precedence.

## Task 4: Build the Copilot Plugin and Mode-Aware Hooks

**Files:**
- Create: `plugin.json`
- Create: `com.github.copilot/hooks/hooks.json`
- Create: `com.github.copilot/hooks/subagent-start.cjs`
- Create: `com.github.copilot/agents/ponytail-reviewer.agent.md`
- Create: `com.github.copilot/agents/ponytail-researcher.agent.md`
- Create: `scripts/check-plugin.cjs`
- Create: `test/unit/hooks.test.cjs`
- Modify: `package.json`

**Interfaces:**
- `subagent-start.cjs` consumes Copilot camelCase JSON on stdin: `cwd`, `agentName`, `sessionId`, and `timestamp`; reads the same mode-state contract as the extension and returns `{ "additionalContext": string }` or `{}`.
- Hook failures are guidance failures only: malformed input returns `{}` and never denies or blocks an action.

- [ ] **Step 1: Write hook contract tests**

Create `test/unit/hooks.test.cjs`. Spawn `subagent-start.cjs` with `process.execPath`, provide Copilot camelCase JSON on stdin, set `CLAUDE_CONFIG_DIR` and `XDG_CONFIG_HOME` to temporary directories, and parse stdout as one JSON object. Assert that a workspace mode of `lite` returns upstream lite instructions; a workspace mode of `off` returns `{}`; no active workspace mode uses the configured default without persisting it; malformed JSON, missing `cwd`, and missing `agentName` return `{}`; no output includes a second JSON object.

- [ ] **Step 2: Run the focused hook test and verify it fails**

Run: `node --test test/unit/hooks.test.cjs`
Expected: FAIL because the hook scripts and plugin manifest do not exist.

- [ ] **Step 3: Register the Copilot lifecycle events**

Create `plugin.json` with the Agent Plugins 1.0 schema, name `ponytail-vscode`, version `0.1.0`, MIT license, upstream project URL, and author attribution. Create `com.github.copilot/hooks/hooks.json` with only the subagent lifecycle event. The extension contributes main-chat instructions; omitting `sessionStart` avoids injecting the same rules twice:

```json
{
  "version": 1,
  "hooks": {
    "subagentStart": [
      {
        "type": "command",
        "command": "node \"${PLUGIN_ROOT}/com.github.copilot/hooks/subagent-start.cjs\"",
        "timeoutSec": 5
      }
    ]
  }
}
```

Create `plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "ponytail-vscode",
  "version": "0.1.0",
  "description": "Ponytail skills and subagent guidance for GitHub Copilot",
  "license": "MIT",
  "homepage": "https://github.com/DietrichGebert/ponytail"
}
```

Create `com.github.copilot/hooks/subagent-start.cjs`:

```js
const fs = require('node:fs');
const { getEffectiveMode } = require('../../shared/mode-state.cjs');
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions.js');

try {
  const input = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
  const event = JSON.parse(input);
  if (typeof event.cwd !== 'string' || typeof event.agentName !== 'string') {
    fs.writeSync(1, '{}');
  } else {
    const mode = getEffectiveMode(event.cwd);
    fs.writeSync(1, mode === 'off' ? '{}' : JSON.stringify({ additionalContext: getPonytailInstructions(mode) }));
  }
} catch (error) {
  fs.writeSync(2, `${error.message}\n`);
  fs.writeSync(1, '{}');
}
```

Create `com.github.copilot/agents/ponytail-reviewer.agent.md`:

```markdown
---
name: ponytail-reviewer
description: Read-only review of a focused code change for bugs, risks, tests, and unnecessary complexity.
user-invocable: true
tools: ['read', 'search']
---
Review only the requested change or named files. Read the relevant callers and tests before reporting findings. Use the bundled `ponytail-review` skill when available. Make no edits. Return concrete findings with paths, impact, and the smallest correction; say what you did not check.
```

Create `com.github.copilot/agents/ponytail-researcher.agent.md`:

```markdown
---
name: ponytail-researcher
description: Read-only investigation of a focused codebase question or implementation option.
user-invocable: true
tools: ['read', 'search']
---
Investigate only the named question. Read the owning code and its callers, tests, and local documentation. Prefer existing helpers and platform features over new code. Make no edits. Return a short answer with evidence paths, assumptions, and anything you could not verify.
```

`subagent-start.cjs` parses the full stdin payload, validates `cwd` and `agentName`, reads the workspace mode or upstream default, returns `{}` for `off`, and otherwise returns `getPonytailInstructions(mode)` as `additionalContext`. The code above returns valid no-op JSON on malformed input and never denies or blocks delegation. Do not log prompts, transcripts, or tool data.

Do not configure agent-scoped hooks. The plugin-wide hook covers supported user-defined agents without relying on the VS Code conversion path that currently drops agent-scoped hooks.

Implement `scripts/check-plugin.cjs` without a new runtime dependency. It validates the plugin schema marker, plugin name/version, all hook command paths, agent frontmatter names, the six skill directory/name pairs, and presence of the full MIT license. Add `"check:plugin": "node scripts/check-plugin.cjs"` and invoke it in CI.

- [ ] **Step 4: Run hook and plugin checks**

Run: `node --test test/unit/hooks.test.cjs` and `npm run check:plugin`
Expected: PASS; every hook fixture produces parseable JSON, and plugin paths/skills/agents validate.

- [ ] **Step 5: Record the live-hook acceptance dependency**

Do not claim host-level Copilot hook verification in this task: the status-bar mode control is implemented in Task 5 and a live profile is unavailable during this task. Task 8 is the release gate: install both artifacts through `chat.pluginLocations`, switch mode in VS Code, delegate to `ponytail-reviewer`, and verify the emitted context matches the mode selected for the active workspace. If the host's `cwd` does not resolve to the same workspace key written by the extension, fix the state mapping before release. Verify `off` emits no context, and record the built-in `general-purpose` exception or organization policy that prevents hooks from firing.

## Task 5: Add Native VS Code Mode Controls and Contributions

**Files:**
- Modify: `src/extension.ts`
- Modify: `package.json`
- Modify: `test/suite/index.ts`
- Create: `test/suite/mode.test.ts`
- Create: `generated/instructions/ponytail-lite.instructions.md`
- Create: `generated/instructions/ponytail-full.instructions.md`
- Create: `generated/instructions/ponytail-ultra.instructions.md`

**Interfaces:**
- Register command `ponytail.setMode`; it shows a Quick Pick for `off`, `lite`, `full`, and `ultra`, persists the choice with `writeMode`, updates the status bar, and calls `vscode.commands.executeCommand('setContext', 'ponytail.mode', mode)`.
- Contribute the generated mode instructions conditionally with `when` values `ponytail.mode == 'lite'`, `ponytail.mode == 'full'`, and `ponytail.mode == 'ultra'`. `off` matches none.
- The extension reads the current workspace root when available. With no open workspace it reads/writes shared state and still activates.

- [ ] **Step 1: Add extension tests for mode behavior**
Create `test/suite/mode.test.ts`:

```ts
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
suite('Ponytail mode command', () => {
  test('persists an explicit mode and contributes all mode instruction files', async () => {
    const extension = vscode.extensions.getExtension('ponytail-vscode.ponytail-vscode');
    assert.ok(extension);
    await extension.activate();
    await vscode.commands.executeCommand('ponytail.setMode', 'ultra');
    const state = require(path.join(extension.extensionPath, 'shared', 'mode-state.cjs'));
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    assert.equal(state.readMode(workspaceRoot), 'ultra');
    const instructions = extension.packageJSON.contributes.chatInstructions;
    assert.deepEqual(instructions.map((item: { when: string }) => item.when), [
      "ponytail.mode == 'lite'",
      "ponytail.mode == 'full'",
      "ponytail.mode == 'ultra'",
    ]);
    for (const item of instructions) {
      assert.equal(fs.existsSync(path.join(extension.extensionPath, item.path)), true);
    }
  });

  test('does not persist an invalid explicit mode', async () => {
    const extension = vscode.extensions.getExtension('ponytail-vscode.ponytail-vscode');
    assert.ok(extension);
    await extension.activate();
    const state = require(path.join(extension.extensionPath, 'shared', 'mode-state.cjs'));
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    state.writeMode('full', workspaceRoot);
    await vscode.commands.executeCommand('ponytail.setMode', 'invalid');
    assert.equal(state.readMode(workspaceRoot), 'full');
  });
});
```

The command accepts an optional valid mode argument for programmatic callers and tests; without an argument it shows the Quick Pick. Test root-less state storage in Task 3's unit tests. Verify picker dismissal, status-bar rendering, and evaluated context in the manual Copilot acceptance test.

- [ ] **Step 2: Run the focused extension test and verify it fails**

Run: `npm run test:extension`
Expected: FAIL because the current handler is a no-op and the mode context is not set.

- [ ] **Step 3: Implement the mode picker and status item**
Implement `src/extension.ts` with this mode controller. It loads the shared CJS module from the installed extension path so the bundle does not change `__dirname`-relative upstream paths:

```ts
import * as path from 'node:path';
import * as vscode from 'vscode';

type Mode = 'off' | 'lite' | 'full' | 'ultra';
type ModeState = {
  getEffectiveMode(workspaceRoot?: string): Mode;
  writeMode(mode: Mode, workspaceRoot?: string): void;
};

const modes: Array<vscode.QuickPickItem & { mode: Mode }> = [
  { label: 'Off', mode: 'off' },
  { label: 'Lite', mode: 'lite' },
  { label: 'Full', mode: 'full' },
  { label: 'Ultra', mode: 'ultra' },
];

function isMode(value: unknown): value is Mode {
  return value === 'off' || value === 'lite' || value === 'full' || value === 'ultra';
}

export function activate(context: vscode.ExtensionContext): void {
  const modeState = require(path.join(context.extensionPath, 'shared', 'mode-state.cjs')) as ModeState;
  let workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'ponytail.setMode';

  const refresh = (): void => {
    const mode = modeState.getEffectiveMode(workspaceRoot);
    status.text = `$(symbol-misc) Ponytail: ${mode.toUpperCase()}`;
    status.tooltip = `Ponytail mode: ${mode}. Select to change.`;
    void vscode.commands.executeCommand('setContext', 'ponytail.mode', mode);
  };

  context.subscriptions.push(
    status,
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      refresh();
    }),
    vscode.commands.registerCommand('ponytail.setMode', async (requestedMode?: unknown) => {
      let mode: Mode;
      if (requestedMode === undefined) {
        const selected = await vscode.window.showQuickPick(modes, { placeHolder: 'Select Ponytail mode' });
        if (!selected) return;
        mode = selected.mode;
      } else if (isMode(requestedMode)) {
        mode = requestedMode;
      } else {
        return;
      }
      modeState.writeMode(mode, workspaceRoot);
      refresh();
    }),
  );

  refresh();
  status.show();
}

export function deactivate(): void {}
```

- [ ] **Step 4: Contribute skills, agents, and conditional instructions**

Add these contribution values to `package.json`:

```json
{
  "chatSkills": [
    { "path": "./skills/ponytail/SKILL.md" },
    { "path": "./skills/ponytail-review/SKILL.md" },
    { "path": "./skills/ponytail-audit/SKILL.md" },
    { "path": "./skills/ponytail-debt/SKILL.md" },
    { "path": "./skills/ponytail-gain/SKILL.md" },
    { "path": "./skills/ponytail-help/SKILL.md" }
  ],
  "chatAgents": [
    { "path": "./com.github.copilot/agents/ponytail-reviewer.agent.md" },
    { "path": "./com.github.copilot/agents/ponytail-researcher.agent.md" }
  ],
  "chatInstructions": [
    { "path": "./generated/instructions/ponytail-lite.instructions.md", "when": "ponytail.mode == 'lite'" },
    { "path": "./generated/instructions/ponytail-full.instructions.md", "when": "ponytail.mode == 'full'" },
    { "path": "./generated/instructions/ponytail-ultra.instructions.md", "when": "ponytail.mode == 'ultra'" }
  ]
}
```

Add those arrays under the existing `contributes` object. Set activation to `onStartupFinished` so initial mode/context and status are ready before chat. Add `mocha.addFile(path.resolve(__dirname, 'mode.test.js'))` to `test/suite/index.ts`. Update the `package` script to `npm run prepare:skills && npm run generate:instructions && npm run compile && vsce package`, so every VSIX includes current mode instructions and the off-safe core-skill metadata. Update CI to run `npm run prepare:skills`, `npm run generate:instructions`, `npm run check:upstream`, and `npm run check:plugin` before tests and packaging.

- [ ] **Step 5: Run extension-host tests**

Run: `npm run test:extension`
Expected: PASS; activation initializes mode context, a valid command argument changes persisted mode, an invalid argument leaves mode unchanged, and the contribution manifest exposes exactly three mode-specific instruction files. Picker dismissal and status-bar rendering are checked in the manual acceptance test.

- [ ] **Step 6: Verify mode-conditioned instruction behavior in Copilot Chat**

In the supported VS Code profile, switch successively to `lite`, `full`, `ultra`, and `off`. Use the Chat customization diagnostics view to verify exactly the corresponding instruction file is active for each level and none is active for `off`. If contributed instruction `when` conditions do not reevaluate with `setContext` in the supported stable harness, treat this as a release blocker and return the proposed fallback to the user for design approval; do not add an unapproved second injection path.

## Task 6: Add the Reviewable Upstream Update Workflow

**Files:**
- Create: `.github/workflows/upstream-update.yml`
- Modify: `test/unit/upstream.test.cjs`

**Interfaces:**
- The workflow checks out the repository default branch without persisting credentials, resolves and checks out the exact upstream release commit, calls the already-reviewed `scripts/sync-upstream.cjs`, runs each validation step, then opens one draft `upstream/<tag>` PR. If an open PR already exists, it exits without rewriting its branch; if a same-named branch exists without an open PR, it refuses to overwrite it.
- The workflow has `schedule` and `workflow_dispatch`, and its only write operation creates/updates a pull request. It has no release, publish, merge, or deployment step.

- [ ] **Step 1: Write workflow-policy tests**

Add a `node:test` case to `test/unit/upstream.test.cjs` that parses `.github/workflows/upstream-update.yml` with the installed `yaml` package. Assert `schedule` and `workflow_dispatch` exist; permissions are exactly `contents: write` and `pull-requests: write`; checkout pins `ref: ${{ github.event.repository.default_branch }}` and sets `persist-credentials: false`; the release-resolution step checks out `$commit` detached; and separate steps occur in this order before PR creation: sync, `npm ci`, prepare skills, generate instructions, upstream check, plugin check, `npm test`, VSIX package. Assert the PR step runs after validation, calls `gh auth setup-git` only there, checks for an existing open PR, refuses to overwrite a conflicting remote branch, and uses a normal non-force push. Assert no step runs `gh pr merge`, `vsce publish`, Marketplace upload, or release creation, and the PR body accurately says the workflow validated before creation while GITHUB_TOKEN may not trigger downstream PR CI. The current workflow does not exist, so this must fail in RED.

- [ ] **Step 2: Run the workflow test and verify it fails**
Run: `node --test test/unit/upstream.test.cjs`
Expected: FAIL because `.github/workflows/upstream-update.yml` does not exist.

- [ ] **Step 3: Harden the sync command**
- [ ] **Step 3: Add the scheduled and manual PR workflow**

Create `.github/workflows/upstream-update.yml`:

```yaml
name: Upstream update
on:
  schedule:
    - cron: '17 10 * * 1'
  workflow_dispatch:
permissions:
  contents: write
  pull-requests: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
        with:
          ref: ${{ github.event.repository.default_branch }}
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '22'
      - name: Resolve upstream release
        id: upstream
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          tag="$(gh api repos/DietrichGebert/ponytail/releases/latest --jq .tag_name)"
          source="$RUNNER_TEMP/ponytail-upstream"
          git clone --filter=blob:none --no-checkout https://github.com/DietrichGebert/ponytail.git "$source"
          git -C "$source" fetch --depth=1 origin "refs/tags/$tag:refs/tags/$tag"
          commit="$(git -C "$source" rev-parse "$tag^{commit}")"
          git -C "$source" checkout --detach "$commit"
          printf 'tag=%s\ncommit=%s\nsource=%s\n' "$tag" "$commit" "$source" >> "$GITHUB_OUTPUT"
      - name: Import allow-listed upstream assets
        env:
          SOURCE: ${{ steps.upstream.outputs.source }}
          TAG: ${{ steps.upstream.outputs.tag }}
          COMMIT: ${{ steps.upstream.outputs.commit }}
        run: node scripts/sync-upstream.cjs --source "$SOURCE" --release "$TAG" --commit "$COMMIT"
      - name: Install dependencies
        run: npm ci
      - name: Prepare skills
        run: npm run prepare:skills
      - name: Generate instructions
        run: npm run generate:instructions
      - name: Check upstream assets
        run: npm run check:upstream
      - name: Check plugin structure
        run: npm run check:plugin
      - name: Run tests
        run: npm test
      - name: Build VSIX
        run: npm run package
      - name: Open review pull request
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ steps.upstream.outputs.tag }}
        run: |
          set -euo pipefail
          branch="upstream/$TAG"
          gh auth setup-git
          existing="$(gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty')"
          if [ -n "$existing" ]; then
            echo "Open upstream PR #$existing already exists; leaving its branch unchanged."
            exit 0
          fi
          if git ls-remote --exit-code --heads origin "refs/heads/$branch" >/dev/null 2>&1; then
            echo "Refusing to overwrite existing branch $branch without an open PR." >&2
            exit 1
          fi
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git switch -c "$branch"
          git add upstream.json upstream LICENSE skills hooks generated/instructions
          if git diff --cached --quiet; then exit 0; fi
          git commit -m "chore: update Ponytail assets to $TAG"
          git push origin "HEAD:refs/heads/$branch"
          base="$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)"
          gh pr create --draft --base "$base" --head "$branch" --title "chore: update Ponytail assets to $TAG" --body "Updates the pinned Ponytail assets. This workflow validated the update before opening this PR. GitHub Actions workflows may not auto-trigger for PRs created with GITHUB_TOKEN; a maintainer must verify required checks and review before merge or release."
```

The workflow runs no publication or merge command. The manual workflow check requires the repository to be hosted on GitHub with Actions enabled; in this current non-Git workspace, validate the YAML and scripts locally and perform the live PR check after the source is hosted.

- [ ] **Step 4: Test updater behavior and workflow constraints**
Run: `node --test test/unit/upstream.test.cjs`, `npm run check:upstream`, and inspect the workflow to confirm only PR creation has write permissions.
Expected: PASS; malicious/traversal paths and invalid pins fail before writing, and no workflow step publishes or merges.

## Task 7: Document Installation, Offline Use, and Manual Release

**Files:**
- Create: `README.md`
- Create: `THIRD-PARTY-NOTICES.md`
- Modify: `package.json`
- Modify: `.vscodeignore`
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`
- Create: `test/unit/package-contents.test.cjs`

**Interfaces:**
- README documents the extension VSIX and Agent Plugin as separate installable artifacts, their shared mode behavior, supported host/version prerequisites, known subagent limits, and exact test/package commands.
- `npm run package` emits `ponytail-vscode-0.1.0.vsix`; the root repository remains installable as an Agent Plugin from a Git source.

- [ ] **Step 1: Write package-content tests**

Create `test/unit/package-contents.test.cjs`. Assert the extension manifest references all six skill paths, three generated mode-instruction paths, two agent paths, and `ponytail.setMode`; assert the packaged core skill has `disable-model-invocation: true`; assert every generated instruction contains the VS Code mode-control note; assert `.vscodeignore` does not exclude runtime paths or `LICENSE` but excludes `upstream/**`, `scripts/**`, `.superpowers/**`, `.vscode/**`, `.vscode-test/**`, `out/**`, `tsconfig.json`, `esbuild.mjs`, and `package-lock.json`; assert `.gitignore` excludes `.superpowers/`; assert plugin hook paths exist; assert updater workflow contains no publish or merge action.

- [ ] **Step 2: Run package-content tests and verify they fail**

Run: `node --test test/unit/package-contents.test.cjs`
Expected: FAIL until the extension manifest, generated assets, plugin files, and ignore list agree.

- [ ] **Step 3: Write user and maintainer documentation**

Document that the VSIX provides the status-bar selector and native extension contributions, while the Copilot Agent Plugin supplies lifecycle hooks; installing only the VSIX does not provide plugin-wide `subagentStart` injection. Explain that VS Code mode changes must use the status-bar control or `Ponytail: Set Mode`; invoking the preserved upstream `/ponytail lite`, `/ponytail full`, or `/ponytail ultra` skill does not mutate extension state. Document that hook execution requires a supported VS Code/Copilot version, enabled hooks, a trusted plugin, and Node.js on `PATH`; `general-purpose` does not emit the hook. Describe offline skill use and that upstream changes arrive as PRs for review.

Add exact developer commands: `npm ci`, `npm run prepare:skills`, `npm run generate:instructions`, `npm run check:upstream`, `npm run check:plugin`, `npm test`, `npm run package`, and `npm exec -- vsce ls`. Manual release steps must require a maintainer to set `publisher` to an owned VS Marketplace publisher ID, inspect the upstream diff, pass all CI and live Copilot checks, update the extension/plugin versions together, and explicitly publish each artifact. State that the updater does not publish or merge.

In `THIRD-PARTY-NOTICES.md`, attribute DietrichGebert and the upstream repository, point to `upstream.json` as the authoritative release/commit record (so reviewed updates do not leave a stale version string), and state that the full MIT license is in `LICENSE` and included in the packaged VSIX and plugin source.

Update `.vscodeignore` to exclude maintenance and development files: `upstream/**`, `scripts/**`, `.superpowers/**`, `.vscode/**`, `.vscode-test/**`, `out/**`, `test/**`, `src/**`, `node_modules/**`, `.github/workflows/**`, `docs/**`, `package-lock.json`, `tsconfig.json`, and `esbuild.mjs`. Keep `dist/extension.js`, `shared/**`, `hooks/**`, `skills/**`, `generated/**`, `com.github.copilot/**`, `README.md`, and `LICENSE` in the VSIX. Add `.superpowers/` to `.gitignore` so SDD briefs/reports are not staged accidentally when the project is hosted later.

- [ ] **Step 4: Run package-content and full test suites**

Run: `node --test test/unit/package-contents.test.cjs` and `npm test`.
Expected: PASS for package contents, unit tests, and extension-host tests.

## Task 8: Final Artifact and Live Acceptance Checks

**Files:**
- No new files; fix only a failure tied to the relevant earlier task, then rerun that task's test.

**Interfaces:**
- The final output consists of a valid VSIX plus a valid root Agent Plugin; both contain the same pinned upstream skill content and license.

- [ ] **Step 1: Build the distributable artifacts**

Run: `npm run prepare:skills`, `npm run generate:instructions`, `npm run check:upstream`, `npm run check:plugin`, `npm test`, and `npm run package`.
Expected: all commands pass and `ponytail-vscode-0.1.0.vsix` is emitted.

- [ ] **Step 2: Inspect VSIX contents and plugin layout**

Run: `npm exec -- vsce ls` and `node scripts/check-plugin.cjs`.
Expected: VSIX listing includes `LICENSE`, generated skill assets, upstream-derived instructions, extension bundle, plugin hook scripts, and custom agents; excludes raw `upstream/`, source tests, `node_modules`, and docs. Plugin structure check passes from repository root.

- [ ] **Step 3: Perform the full manual acceptance matrix**

In a disposable VS Code 1.142.0+ profile with Copilot Chat, install the VSIX and register the root plugin through the experimental `chat.pluginLocations` setting, without editing the existing workspace settings. Verify default `full`, switch through `lite`, `ultra`, and `off`, restart VS Code, and confirm the selected mode and generated instruction contribution. In `off`, confirm a normal coding request does not auto-load the core skill, then invoke `/ponytail` explicitly and verify it remains available. In the Agent Customizations diagnostics, confirm each skill appears once despite the VSIX and plugin sharing assets; duplicate entries are a release blocker and require a packaging design change. Run each bundled command skill once. Delegate to both custom agents and confirm the subagent uses the selected workspace level (including `lite`, not the default `full`); this verifies that Copilot's `cwd` maps to the same state key written by the extension. Verify `off` emits no context and `general-purpose` is documented as uncovered. Disable the plugin or hooks and confirm the extension commands and contributed skills remain available without claiming subagent injection.

- [ ] **Step 4: Confirm the updater remains review-only**

After the source repository is hosted on GitHub with Actions enabled, run the updater workflow with `workflow_dispatch`. Expected: an upstream difference produces a PR with the exact tag/commit and passing checks; no merge or publish action occurs. Until then, validate the workflow with the static checks and temporary-source sync tests. Do not publish either artifact as part of this task.

## Self-Review

- Spec coverage: two deliverables, offline skills/instructions, native mode UI, shared state, curated agents, subagent hook and limitations, MIT attribution, pinned upstream PR flow, tests, VSIX packaging, documentation, and manual release are all assigned tasks.
- Placeholder scan: no unresolved steps or generic placeholders remain; all commands, paths, test names, hook fields, and failure expectations are specified.
- Type consistency: mode union is `off | lite | full | ultra`; `readMode` and `getEffectiveMode` signatures match every consumer; hook adapters use Copilot camelCase payloads and top-level `additionalContext`.
- Review focus coverage: malformed configuration and Windows paths are tested in Task 3; malformed hook payload and `off` are tested in Task 4; updater path validation and no-auto-publish constraints are tested in Task 6; automatic skill invocation and duplicate contributions are checked in Tasks 2 and 8.
- Repository constraint: no commit or Git initialization step is included because the current workspace is not a Git repository and the design forbids doing so without a separate request.
