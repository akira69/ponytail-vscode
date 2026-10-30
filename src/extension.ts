import * as path from 'node:path';
import * as vscode from 'vscode';

type Mode = 'off' | 'lite' | 'full' | 'ultra';
type ModeState = {
  getEffectiveMode(workspaceRoot?: string): Mode;
  writeMode(mode: Mode, workspaceRoot?: string): void;
  watchMode(workspaceRoot: string | undefined, listener: () => void): vscode.Disposable;
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
  // Loaded from the extension path so the bundle doesn't change __dirname-relative upstream paths.
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

  let modeWatch = modeState.watchMode(workspaceRoot, refresh);
  context.subscriptions.push(
    status,
    { dispose: () => modeWatch.dispose() },
    vscode.window.onDidChangeWindowState(({ focused }) => { if (focused) refresh(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      modeWatch.dispose();
      workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      modeWatch = modeState.watchMode(workspaceRoot, refresh);
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
