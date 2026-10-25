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
