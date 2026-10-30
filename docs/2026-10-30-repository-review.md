# Repository readiness review — 2026-10-30

## Baseline

The local checkout was fast-forwarded from `2caccc2` to `6af822e` from
`Z:\Projects\Ponytail`. This preserved the upstream-lineage and v5.3.3 update
commits. No generated builds, editor state, or dependency directories were copied.
The public companion repository is `akira69/ponytail-vscode`; the existing
extension identity remains `Finch13.ponytail-dietrichgebert-sync`.

## Findings addressed

- **Updates blocked by old-version assertions:** tests hard-coded the currently
  imported release and commit. They now validate immutable-pin shape and hashes;
  the importer still verifies that the approved upstream tag resolves to that commit.
- **Linux CI could not launch the extension host:** CI and updater now use Xvfb.
- **Unsafe updater permission boundary:** importing and executing new upstream
  helpers previously shared a runner with repository-write credentials. Validation
  now has read-only permissions; a clean job applies an allow-listed patch and
  creates a draft PR without executing imported files.
- **Repeated updates could fail after merge or an interrupted PR creation:**
  unchanged pins now stop early. Retry can reuse an identical remote branch;
  divergent trees stop without force-pushing.
- **Path validation differed across operating systems:** manifest paths now reject
  backslashes consistently, including the existing backslash-traversal fixture.
- **Five dependency advisories:** updated development dependencies; npm audit
  reports zero known vulnerabilities. Mocha is external to the test bundle so
  Node resolves its CommonJS export correctly.
- **Missing hosted metadata and upkeep:** added repository/issue links, daily
  upstream release checks, weekly Dependabot PRs, pinned CI actions, lint/audit
  gates, and downloadable CI VSIX artifacts. README release details no longer
  hard-code a second copy of the upstream pin.

## Local evidence

- 40 unit tests: 39 passed; Windows denied one file-symlink fixture, which skipped.
- Three extension-host tests passed in VS Code 1.144.0.
- TypeScript typecheck, Biome lint, upstream checksum check, and plugin validation passed.
- VSIX packaged successfully; selected files contain runtime assets and attribution.
- jscpd found zero clones in 17 integration/test files at 10 lines / 80 tokens.
- Ruff ran but found no Python files; JavaScript/TypeScript lint is handled by Biome.
- `git diff --check` passed. A targeted tracked-file token/private-key scan found
  no matches; this is not a comprehensive secret-history or security audit.

## Release and upstream decisions

Keep this as a companion repository for now. Upstream already owns a different
root package and plugin layout. The maintainer declined a previous manifest
restructure because of other-client regressions:
https://github.com/DietrichGebert/ponytail/pull/911#issuecomment-5985831665.
A future upstream proposal should add an isolated VS Code integration using
upstream assets, with evidence of live Copilot behavior. Personal publisher and
repository automation need not move upstream.

Daily checks propose source updates, but installation updates still require a
reviewed, versioned Marketplace release. No Marketplace publication or upstream
PR was performed. Live Copilot instruction delivery and subagent hooks remain
unverified. Multi-root windows use the first folder, and external mode-file changes
do not immediately refresh an already-open status bar.
