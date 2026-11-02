---
name: ponytail-help
description: >
  Quick reference for ponytail levels, skills and commands. One-shot display.
  Use for /ponytail-help, "ponytail help", "how do I use ponytail".
---

# Ponytail in VS Code

Show this reference when asked for help. Do not change mode or write state files.

## Select a mode

Click the Ponytail status-bar item or run **Ponytail: Set Mode** from the Command Palette, then select Off, Lite, Full, or Ultra. The choice persists for this workspace. Full is the default when no saved selection or configured default exists.

- Lite: build the requested change and mention a smaller option.
- Full: make the smallest complete change and check meaningful logic.
- Ultra: also question whether the work needs to exist.
- Off: disable automatically contributed Ponytail guidance for future requests. Earlier chat context cannot be withdrawn; start a new chat if needed.

Slash-skill invocations and chat messages do not change the extension's saved mode. If asked to change it in chat, explain the status-bar or Command Palette control; do not claim the setting changed.

## Skills

Use `/ponytail` for the core guidance, `/ponytail-review` for a change review, `/ponytail-audit` for a repository audit, `/ponytail-debt` for shortcut tracking, `/ponytail-gain` for the upstream benchmark summary, and `/ponytail-help` for this reference. Benchmark figures are upstream measurements, not savings measured in this extension.

## Defaults and scope

A saved workspace mode takes precedence over `PONYTAIL_DEFAULT_MODE`, then the Ponytail configuration file's `defaultMode`, then Full. The configuration file is `%APPDATA%/ponytail/config.json` on Windows or `~/.config/ponytail/config.json` on macOS/Linux, unless `XDG_CONFIG_HOME` selects another directory. Multi-root windows currently use the first workspace folder.

## Subagents

Automatic subagent guidance requires the separate Copilot Agent Plugin with hooks enabled and Node.js on PATH. Its hook does not cover the built-in `general-purpose` agent; the parent must include the active guidance in that agent's task. Hooks provide instructions, not enforcement.

## Updates

Marketplace installations can use VS Code extension auto-update when a new release is published. For a sideloaded build, install the newer package with **Extensions: Install from VSIX...**. Update the Agent Plugin separately through its plugin manager. An upstream update PR alone does not update installed copies.

Integration: https://github.com/akira69/ponytail-vscode
Upstream Ponytail: https://github.com/DietrichGebert/ponytail
