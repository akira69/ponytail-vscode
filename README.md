# Ponytail Copilot Sync

Ponytail provides mode-aware coding guidance through two separate installable artifacts.

## Upstream Source

This integration is built directly from the official [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) project, not from another Marketplace extension with the Ponytail name. The core guidance, official skills, and shared helper modules are pinned to upstream v5.3.3 at commit [7801d06](https://github.com/DietrichGebert/ponytail/tree/7801d061243d7b753bad0e0b3c057cd250b11755). The upstream README is mirrored verbatim as `UPSTREAM-README.md` and included in the VSIX; [the canonical README at the pinned revision](https://github.com/DietrichGebert/ponytail/blob/7801d061243d7b753bad0e0b3c057cd250b11755/README.md) is available online. The revision and checksums are recorded in `upstream.json`.

The status-bar control, VS Code contributions, and Copilot `subagentStart` adapter are this project's integration layer. The copied upstream README describes Ponytail across agents, including features that are not provided by this VS Code integration.

## Install

**VS Code extension (VSIX):** install Ponytail Copilot Sync from the VS Code Marketplace, or use **Extensions: Install from VSIX...** with a locally built `.vsix`. The extension contributes the status-bar mode control, command, six offline skills, and three mode-specific chat instructions. It does not install the Agent Plugin hook.

**GitHub Copilot Agent Plugin:** install this repository as an Agent Plugin using Copilot's plugin manager. Its `plugin.json`, `com.github.copilot/`, and root `skills/` provide plugin metadata, custom agents, offline skills, and the subagent-start hook. Installing the VSIX alone does not enable that hook; install the plugin separately when subagent guidance is needed.

## Modes

The VS Code status-bar item and **Ponytail: Set Mode** command select `off`, `lite`, `full`, or `ultra`. The extension stores the selection in shared and workspace-specific state; the plugin hook reads that same state and injects the selected guidance when an eligible subagent starts. `/ponytail lite`, `/ponytail full`, and `/ponytail ultra` invoke the core skill but do not persist or change the extension mode.

Skills and generated instructions are bundled locally. They are available offline after installation and do not fetch upstream content at runtime.

## Plugin Hook Requirements and Limits

Automatic subagent guidance requires a supported VS Code and GitHub Copilot version with plugin hooks enabled, the Agent Plugin enabled and trusted, and Node.js available on `PATH`. VS Code plugin hooks are preview functionality and may also be restricted by organization policy. The built-in `general-purpose` subagent does not emit `subagentStart`, so this plugin cannot inject guidance into it; the parent agent must include the relevant guidance when delegating to that agent. Hooks add guidance but do not enforce model behavior.

## Upstream Updates

The scheduled updater imports allow-listed upstream assets, validates them, runs tests, builds the VSIX, and opens a draft pull request for review. It never publishes an artifact or merges a pull request. Upstream changes remain pinned in `upstream.json`; review the diff before merging.

## Development

Requirements: Node.js 22 and npm. From the repository root:

```sh
npm ci
npm run prepare:skills
npm run generate:instructions
npm run check:upstream
npm run check:plugin
npm test
npm run package
npm exec -- vsce ls
```

`npm test` runs unit and VS Code extension-host tests. `npm run package` prepares assets, compiles, and creates the VSIX; `npm exec -- vsce ls` lists the files selected for packaging.

## Manual Release

Marketplace publication requires an owned VS Code publisher ID and credentials. Before release, add the real hosted project `repository` metadata to `package.json`; CI currently passes `--allow-missing-repository` only because this workspace has not been hosted yet. Before release, review the pinned upstream diff, pass CI, and run live Copilot checks for the extension and plugin in a supported VS Code profile. Update the VSIX `package.json` version and Agent Plugin `plugin.json` version together. Publish the VSIX and distribute/update the Agent Plugin as separate artifacts; neither is published automatically by the updater workflow.

## Maintainers

`upstream.json` is the authoritative upstream repository, release, commit, asset allow-list, and checksum record. Use the updater only to propose changes for review; it is not a release mechanism. The project license is MIT; see `LICENSE` and `THIRD-PARTY-NOTICES.md`.