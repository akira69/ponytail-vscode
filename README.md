# Ponytail Copilot Sync

Ponytail provides mode-aware coding guidance through two separate installable artifacts.

## Upstream Source

This is the community-maintained VS Code integration at [akira69/ponytail-vscode](https://github.com/akira69/ponytail-vscode), built directly from the official [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) project. The core guidance, official skills, shared helper modules, and upstream README are imported from a released upstream commit. `upstream.json` is the authoritative release, commit, and checksum record; it changes with each reviewed update. The upstream README is mirrored verbatim as `UPSTREAM-README.md` and included in the VSIX.

The status-bar control, VS Code contributions, and Copilot `subagentStart` adapter are this project's integration layer. The copied upstream README describes Ponytail across agents, including features that are not provided by this VS Code integration.

## Install

**VS Code extension (VSIX):** build with `npm ci && npm run package`, then use **Extensions: Install from VSIX...**. Successful CI runs also attach a `ponytail-vsix` build artifact. The extension identity remains `Finch13.ponytail-dietrichgebert-sync`; the repository name does not change installed-extension identity. Marketplace publication is a separate release step. The extension contributes the status-bar mode control, command, six offline skills, and three mode-specific chat instructions. It does not install the Agent Plugin hook.

**GitHub Copilot Agent Plugin:** install this repository as an Agent Plugin using Copilot's plugin manager. Its `plugin.json`, `com.github.copilot/`, and root `skills/` provide plugin metadata, custom agents, offline skills, and the subagent-start hook. Installing the VSIX alone does not enable that hook; install the plugin separately when subagent guidance is needed.

## Modes

The VS Code status-bar item and **Ponytail: Set Mode** command select `off`, `lite`, `full`, or `ultra`. The extension stores the selection in shared and workspace-specific state; the plugin hook reads that same state and injects the selected guidance when an eligible subagent starts. `/ponytail lite`, `/ponytail full`, and `/ponytail ultra` invoke the core skill but do not persist or change the extension mode.

Skills and generated instructions are bundled locally. They are available offline after installation and do not fetch upstream content at runtime.

## Plugin Hook Requirements and Limits

Automatic subagent guidance requires a supported VS Code and GitHub Copilot version with plugin hooks enabled, the Agent Plugin enabled and trusted, and Node.js available on `PATH`. VS Code plugin hooks are preview functionality and may also be restricted by organization policy. The built-in `general-purpose` subagent does not emit `subagentStart`, so this plugin cannot inject guidance into it; the parent agent must include the relevant guidance when delegating to that agent. Hooks add guidance but do not enforce model behavior.

## Upstream Updates

The updater checks the latest upstream release daily at 10:17 UTC and can also be run from **Actions > Upstream update > Run workflow**. It imports only allow-listed assets, records the tag/commit/checksums, validates the integration, runs tests under a virtual display, builds a VSIX, and opens a draft PR. If the pin is unchanged, it skips the build and PR. It does not follow unreleased upstream commits.

Validation runs with read-only repository permissions. A separate clean job applies only the imported paths and opens the PR with write permissions; it does not execute the imported code. Existing open PRs are reused, and an interrupted push can be retried without force-pushing. Review and merge remain manual. Bot-created PRs using `GITHUB_TOKEN` do not trigger ordinary CI: close and reopen the PR as a maintainer before merging. Enable **Settings > Actions > General > Allow GitHub Actions to create and approve pull requests** for this repository; the workflow creates draft PRs and never approves them.

Dependabot proposes npm and GitHub Actions updates weekly. CI runs on Windows and Linux and checks lint, dependency advisories, upstream hashes, plugin structure, unit tests, and Linux extension-host tests. A failed import or test leaves the installed extension unchanged and needs maintainer attention. Check Actions failures and keep notifications enabled; GitHub can disable schedules in inactive public repositories after 60 days.

This keeps source updates proposed automatically, not installed extensions perpetually current. After reviewing an update, bump both integration versions, validate live Copilot behavior, then publish a Marketplace release. VS Code can update Marketplace installations when extension auto-update is enabled. Sideloaded VSIX users must install the newer VSIX; Agent Plugin updates remain separate.

## Development

Requirements: Node.js 22 and npm. From the repository root:

```sh
npm ci
npm run lint
npm audit --audit-level=moderate
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

Marketplace publication requires ownership of publisher `Finch13` and release credentials. No publishing credential is needed by CI or the updater. Before release, review the pinned upstream diff, pass CI, and run live Copilot checks for the extension and plugin in a supported VS Code profile. Update the VSIX `package.json` version and Agent Plugin `plugin.json` version together. Publish the VSIX and distribute/update the Agent Plugin as separate artifacts; neither is published automatically by the updater workflow.

## Maintainers

`upstream.json` is the authoritative upstream repository, release, commit, asset allow-list, and checksum record. Use the updater only to propose changes for review; it is not a release mechanism. The project license is MIT; see `LICENSE` and `THIRD-PARTY-NOTICES.md`.
## Upstream Contribution

A future upstream PR is reasonable for the reusable VS Code controls, contribution declarations, and Copilot adapter. Keep it in an integration subdirectory and reuse upstream assets during packaging. Do not replace upstream's root manifests or copy this repository wholesale: upstream [declined an Agent Plugins restructuring](https://github.com/DietrichGebert/ponytail/pull/911#issuecomment-5985831665) because of compatibility regressions in other clients. Publisher credentials and this repository's update/release automation stay with this integration. Propose the packaging approach to the maintainer before preparing a larger PR.

## Current Validation Limits

Extension-host tests cover activation, command registration, and mode persistence; they do not prove that a live Copilot request received the guidance or that delegated hooks ran. Verify those in a supported Copilot profile before release. Mode scope uses the first workspace folder in multi-root windows. Another window or client can change the shared mode files without immediately refreshing an already-open status bar.
