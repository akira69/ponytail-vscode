import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as vscode from 'vscode';

suite('Ponytail mode command', () => {
  test('persists an explicit mode and contributes all mode instruction files', async () => {
    const extension = vscode.extensions.getExtension('Finch13.ponytail-vscode');
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
  });

  test('does not persist an invalid explicit mode', async () => {
    const extension = vscode.extensions.getExtension('Finch13.ponytail-vscode');
    assert.ok(extension);
    await extension.activate();
    const state = require(path.join(extension.extensionPath, 'shared', 'mode-state.cjs'));
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    state.writeMode('full', workspaceRoot);
    await vscode.commands.executeCommand('ponytail.setMode', 'invalid');
    assert.equal(state.readMode(workspaceRoot), 'full');
  });
});
