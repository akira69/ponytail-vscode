const assert = require('node:assert/strict');
const { test } = require('node:test');
const manifest = require('../../package.json');

test('declares the Ponytail extension and test scripts', () => {
  assert.equal(manifest.name, 'ponytail-vscode');
  assert.equal(manifest.publisher, 'Finch13');
  assert.equal(manifest.engines.vscode, '^1.142.0');
  assert.equal(typeof manifest.scripts.compile, 'string');
  assert.equal(typeof manifest.scripts.test, 'string');
});
