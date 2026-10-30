const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { transformSync } = require('esbuild');
const state = require('../../shared/mode-state.cjs');
const root = path.resolve(__dirname, '../..');

test('external mode writes update both instruction context and status in every window', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-windows-'));
  const keys = ['CLAUDE_CONFIG_DIR', 'PONYTAIL_DEFAULT_MODE'];
  const previous = keys.map((key) => process.env[key]);
  process.env.CLAUDE_CONFIG_DIR = home;
  process.env.PONYTAIL_DEFAULT_MODE = 'full';
  const contexts = [];
  t.after(() => {
    for (const context of contexts) for (const disposable of context.subscriptions) disposable.dispose();
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
    fs.rmSync(home, { recursive: true, force: true });
  });
  const code = transformSync(fs.readFileSync(path.join(root, 'src/extension.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  const workspace = path.join(home, 'workspace');
  const windows = [0, 1].map(() => {
    const status = { text: '', dispose() {} };
    let mode;
    const disposable = { dispose() {} };
    const vscode = {
      StatusBarAlignment: { Right: 2 },
      workspace: { workspaceFolders: [{ uri: { fsPath: workspace } }], onDidChangeWorkspaceFolders: () => disposable },
      window: { createStatusBarItem: () => ({ ...status, show() {}, set text(value) { status.text = value; } }), onDidChangeWindowState: () => disposable },
      commands: { registerCommand: () => disposable, executeCommand: async (command, key, value) => {
        assert.equal(command, 'setContext'); assert.equal(key, 'ponytail.mode'); mode = value;
      } },
    };
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, require: (name) => name === 'vscode' ? vscode : require(name) });
    const context = { extensionPath: root, subscriptions: [] };
    contexts.push(context);
    module.exports.activate(context);
    return { status, mode: () => mode };
  });
  assert.ok(windows.every((window) => window.mode() === 'full'));
  state.writeMode('off', workspace);
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && windows.some((window) => window.mode() !== 'off')) await delay(50);
  for (const window of windows) {
    assert.equal(window.mode(), 'off');
    assert.match(window.status.text, /OFF$/);
  }
});
