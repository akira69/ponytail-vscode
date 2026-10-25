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
