# Maintaining Ponytail Copilot Sync

User-facing installation and usage are in the [README](../README.md).

## Upstream Source

This is the community-maintained VS Code integration at [akira69/ponytail-vscode](https://github.com/akira69/ponytail-vscode), built directly from the official [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) project. The core guidance, official skills, shared helper modules, and upstream README are imported from a released upstream commit. `upstream.json` is the authoritative release, commit, and checksum record; it changes with each reviewed update. The upstream README is mirrored verbatim as `UPSTREAM-README.md` and included in the VSIX.

The status-bar control, VS Code contributions, and Copilot `subagentStart` adapter are this project's integration layer. Raw core and help skills remain under `upstream/skills/` with upstream checksums. `prepare:skills` replaces only the core session-control paragraph with truthful VS Code controls and delegation guidance, and produces VS Code-specific help from `resources/ponytail-help.md`. The coding rules remain upstream-derived. If the upstream control paragraph changes, preparation fails for maintainer review; it never silently guesses. The same prepared core feeds main-chat instructions and subagent guidance. The copied upstream README describes Ponytail across agents, including features that are not provided by this VS Code integration.

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

Extension-host tests cover activation, command registration, and mode persistence; they do not prove that a live Copilot request received the guidance or that delegated hooks ran. Verify those in a supported Copilot profile before release. Mode scope uses the first workspace folder in multi-root windows. Changes to the effective mode/configuration files refresh the status bar and instruction context within approximately one second; focus regain also refreshes them. Selecting Off cannot remove guidance already present in chat history.

## Testing Updates Without a New Release

Manual updater runs operate on the selected branch and its immutable dispatch commit. Scheduled runs still use the default branch. To exercise an update, create a disposable `codex/updater-smoke-*` branch, import an older real upstream release using `scripts/sync-upstream.cjs`, regenerate assets, commit, and push that branch. Dispatch **Upstream update** on it. The workflow should validate and open a draft PR targeting that test branch, named `upstream/<test-branch>/<release>`; main stays current.

Check the generated patch, source hashes, test results, and PR base. Dispatch again before merging to verify it reuses the open PR. Merge only into the test branch, then dispatch again to verify an unchanged pin skips validation and proposal. Delete the test branches afterward. The updater is tested using its real jobs and credentials, not a mocked release or a main-branch downgrade.
