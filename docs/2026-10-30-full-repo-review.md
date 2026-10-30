# Ponytail and Superpowers full-repository review

What this repo does: It packages official Ponytail guidance for offline use in VS Code and a separate Copilot Agent Plugin. It adds persistent mode controls and reviewed upstream updates. The assumed load is one developer using multiple editor windows, plus a daily update workflow.

## Review scope and result

Independent Ponytail and Superpowers reviewers examined the full implementation,
its original design, source provenance, bundled skills, runtime, build, tests,
and update workflow at `e5f8e68`. This was not limited to the latest commit.
Both found the small architecture appropriate; neither found a critical security
issue or a reason to add a runtime updater, dependency, or transformation framework.

### Confirmed findings, now addressed

1. **Mode changes in another window left chat instructions stale.**
   - What this is: `src/extension.ts` uses a context key to select the active instructions.
   - Problem: another window could save Off while this window retained Full indefinitely; the hook independently read Off.
   - Fix: `shared/mode-state.cjs` observes the effective state and default-config files, with a one-second polling interval; the extension refreshes status and context together, also refreshing on focus. Watchers are disposed on workspace changes/deactivation.
   - If skipped: main-chat and delegated-agent guidance disagree. The regression exercises two instances of the real extension code and real mode-file writes through a minimal VS Code API double; it failed before the fix and passed afterward.

2. **Upstream prompts advertised controls the extension does not implement.**
   - What this is: upstream core/help describe host-specific session commands as well as portable coding rules.
   - Problem: saying “stop ponytail” or invoking a slash skill does not change the saved extension mode, despite the old prompt promising it; help described Claude-only update commands.
   - Fix: preserve raw upstream core/help under `upstream/skills/`; generate an adapted core and host-owned help in the existing preparation step. Core generation replaces one exact control paragraph and fails if its upstream shape changes. Coding rules remain unchanged.
   - If skipped: the model can claim a mode/update operation succeeded when no corresponding host action occurred. Regressions cover preserved coding rules, unsupported controls, changed/duplicate anchors, and generated versus injected instructions.

3. **The coordinator lacked the fallback for general-purpose subagents.**
   - What this is: Copilot's built-in `general-purpose` agent does not emit `subagentStart`.
   - Problem: the original design required parents to pass guidance explicitly, but only README prose said so.
   - Fix: the shared adapted core tells the parent to include the active level and guidance when delegating, especially to `general-purpose`.
   - If skipped: this agent remains uncovered even when hooks are installed correctly. Every enabled generated mode and injected hook payload is checked for that guidance.

## Efficiency and maintenance

Runtime stays offline. State observation polls two small paths per window, with no
network calls. Core preparation uses one checked paragraph replacement; help is
explicitly host-owned. Four other skills and both imported helper modules remain
verbatim upstream assets. Preparation and hash checks catch unexpected drift.
No new runtime dependency or generic adaptation framework was added.

## Dependency review

PRs #1–#5 were reviewed against their immutable heads, official action definitions,
and successful Windows/Linux/extension-host CI, then merged. The setup-node PR
rebased automatically during conflict handling; its new head `198f65b` was reviewed
again and merged only after its checks passed. The rejected non-fast-forward push
was not forced. Combined main `d3c4263` passed CI.

Upload-artifact v7 still defaults to ZIP archiving; download-artifact v8 supports
that path. The repository does not use `archive: false`, fork-sensitive triggers,
or registry-auth/cache configuration affected by the action major-version changes.

## Verification

Local validation: 45 unit tests, 44 passed and one Windows file-symlink fixture
skipped due to OS permission; three extension-host tests passed. Lint, TypeScript,
upstream hashes, plugin checks, packaging, and whitespace checks passed. npm audit
reported zero vulnerabilities. jscpd found zero clones in 19 integration/test files
at 10 lines / 80 tokens. Ruff found no Python files; Biome checks JS/TS.

The updater's real unchanged-pin run succeeded:
https://github.com/akira69/ponytail-vscode/actions/runs/41073122480.
The full changed-pin replay and final hosted CI evidence are recorded below after execution.

An independent fresh-context final review of the implemented fixes found no
actionable issue and approved proceeding to hosted verification.

Verdict: The three confirmed implementation gaps are fixed; release readiness still requires live Copilot acceptance.

Not checked: paid/live Copilot request contents, actual model compliance, duplicate-skill presentation with both artifacts installed, and whether every hook `cwd` matches the extension's first workspace folder. Neither unit tests nor extension-host tests establish these. No Marketplace publication or upstream PR was performed.
