# Updater and Host Compatibility Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement these steps, followed by independent review.

**Goal:** Verify real upstream updates without a new release, merge reviewed dependency updates, and correct the full-repo review findings.

**Architecture:** Preserve upstream source and hashes. Generate a narrowly adapted core skill and host-owned help during the existing preparation step; both main-chat instructions and hooks consume the packaged core. Keep the two-job updater and use the dispatched branch as its isolated base.

**Tech Stack:** Node.js, TypeScript, VS Code, GitHub Actions, existing Node tests.

**Spec:** User request of 2026-10-30 and `../specs/2026-10-23-ponytail-vscode-extension-design.md`; this follow-up corrects that design's assumption that an unchanged upstream body is always appropriate for Copilot.

## Constraints and choices

- No runtime downloads, new runtime dependency, Marketplace publishing, or upstream PR.
- Preserve raw upstream core/help; adapt only host control wording. Keep coding rules unchanged.
- A checked core-paragraph replacement fails when upstream wording changes; do not silently guess.
- Keep help explicitly host-owned so Claude-only commands cannot reappear on an upstream refresh.
- Refresh external mode changes within one second, and on focus regain. Dispose watchers on workspace changes and deactivation.
- Smoke test uses a real older release on a disposable branch; never downgrade main.
- Reuse existing tests and scripts; no general prompt transformation framework.

## Review focus

- Changed upstream control paragraph must fail generation with a useful error.
- Main-chat and subagent instructions must agree about controls and include delegation fallback.
- Another window selecting Off must update instruction eligibility as well as the status bar.
- Repeating an update must not duplicate PRs; an unchanged pin must do no work.
- Uploaded patch must round-trip through the current artifact actions before proposing a real PR.

## Tasks

1. **Dependency review:** inspect immutable heads, official action compatibility, CI, and merge safe PRs. Resolve overlap without force-pushing; revalidate changed heads.
2. **Prompt adapter:** add failing assertions to `test/unit/host-compatibility.test.cjs`; extend `scripts/prepare-skills.cjs` with exported `prepareSkill(name, raw)`; move help provenance to `upstream/skills/ponytail-help/SKILL.md`; add host help under `resources/`; update checksum verification and generation tests.
3. **Mode consistency:** add an extension-host regression for an external persisted-mode change; implement `watchMode(workspaceRoot, listener)` in `shared/mode-state.cjs`; refresh status/context and dispose old watchers in `src/extension.ts`.
4. **Updater isolation:** test branch/base selection, then use immutable dispatched SHA and branch in checkout/proposal. Namespace update branches by base. Replay v5.3.2 to v5.3.3 on a test branch; verify PR paths, hashes, validation, retry, and no-change after merging into that test branch.
5. **Closeout:** run full tests, lint, Ruff applicability, audit, duplicate scan, package and diff checks. Obtain fresh independent review, run hosted CI, record evidence, and remove only smoke branches/PRs created for this test.

## Test cycle

Write regressions first, run them and record expected failure, then make the smallest fix and run the full suite. `npm test`, `npm run lint`, `npm audit --audit-level=moderate`, `npm run check:plugin`, `npm run package`, and `git diff --check` must pass. Live paid Copilot behavior remains a separate acceptance gate.
