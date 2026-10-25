# Ponytail VS Code Extension and Copilot Plugin

Date: 2026-10-23
Status: Design approved in chat; implementation not started

## Goal

Deliver a first-class VS Code extension for Ponytail and a companion Copilot Agent Plugin. Preserve upstream Ponytail as the source of truth, package its instructions and skills for offline use, and add native VS Code controls without replacing upstream behavior with a thin wrapper.

The initial upstream baseline is Ponytail v5.3.2, commit `16352ac229eb08a9598dcae48fe9f2b342567d86`, under its MIT license. Do not read or modify the installed `Volvo-AntoniaCanizares.ponytail-vscode` package as source.

The existing workspace root is the target. It currently has workspace settings but no extension source and is not a Git repository. Preserve existing settings. Do not initialize Git or commit unless separately requested and a repository is available.

## Architecture

Use one source tree to produce two installable artifacts:

- **VS Code extension (VSIX):** contributes the Ponytail mode command and status-bar control, persists the selected level using the same mode state as the upstream-compatible hook adapter, and contributes bundled Copilot instructions, skills, and custom agents through supported VS Code extension contribution points. Required assets are packaged so normal use does not require network access.
- **Copilot Agent Plugin:** packages the upstream skills and a Copilot-specific lifecycle adapter. It is needed for plugin-wide Copilot hooks, which an ordinary VS Code extension cannot contribute. It shares the same upstream asset source as the VSIX; build checks prevent the two packages from drifting.

Keep extension-specific UI and state integration separate from mirrored upstream prompts, skills, and license. The plugin uses the Agent Plugins format and places Copilot-specific custom agents and hooks under `com.github.copilot/`.

## Behavior

The extension provides a status-bar level indicator and a command to select `lite`, `full`, `ultra`, or `off`. Mode state is scoped consistently with the upstream runtime, and mode changes affect subsequent work; selecting `off` disables Ponytail guidance. Existing configuration for the default level remains compatible.

Package the upstream core Ponytail skill and the `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, and `ponytail-help` skills as native Copilot skills. Preserve their upstream content and attribution. Add a small set of extension-specific custom agents for focused delegation, initially a read-only reviewer and a researcher. Their role instructions should call on the same Ponytail guidance and use least-privilege tools.

Register a Copilot `subagentStart` plugin hook that reads the active level and prepends the matching Ponytail instructions to eligible subagents. Reuse upstream mode-reading and instruction-building logic where compatible, but implement the Copilot event payload/output contract separately and test it. The current v5.3.2 Copilot hook configuration does not register this event, and the current shared output helper intentionally emits no Copilot context for events other than session start.

Keep upstream `/ponytail band` and `/ponytail band import` out of scope: those features depend on Claude Code's band, board, and session data. Do not emulate their UI or imply that Copilot session data is available.

## Subagent Limits

Copilot's built-in `general-purpose` agent does not emit `subagentStart`; other supported built-in and user-defined agents do. The hook adds guidance but cannot force delegation or enforce model compliance. For the uncovered agent, the coordinator instructions should ask the parent to include Ponytail guidance when delegating. Plugin-provided agents must not depend on agent-scoped hooks because VS Code currently drops that field while converting those agents; use the plugin-wide hook instead.

VS Code documents hooks as Preview. Verify the actual supported VS Code/Copilot versions and hook execution during implementation. If plugin hooks are unavailable or disabled by policy, the skills and extension controls remain usable, but automatic subagent injection is unavailable and must be reported clearly.

## Upstream Updates and Licensing

Pin the upstream release and commit in a small metadata file. A scheduled and manually dispatchable GitHub Actions workflow checks upstream releases, refreshes only the required source assets and compatibility metadata, runs validation, and opens a reviewable pull request. It must never auto-merge, publish, or replace the installed extension. Include the full upstream MIT license and attribution in both relevant distribution artifacts.

## Validation and Release

Include extension build and test configuration, extension-host tests for contributed commands and mode behavior, focused tests for Copilot hook input/output and subagent injection, and checks that bundled assets match the pinned upstream source. Validate both artifacts with a VSIX package build and Agent Plugin structure checks. Document local installation, test commands, manual Marketplace/VSIX release steps, and the separate plugin installation/update path.

Manual release requires maintainer review of the upstream-update PR, checks in a supported VS Code/Copilot session (including a delegated agent), and explicit approval before publishing either artifact. No automatic publication or merge is part of the updater.

## References

- Upstream Ponytail: https://github.com/DietrichGebert/ponytail
- Upstream release: https://github.com/DietrichGebert/ponytail/releases/tag/v5.3.2
- VS Code Agent Plugin hooks: https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference#_hooks-in-plugins
- Copilot subagent hook contract: https://docs.github.com/en/copilot/reference/hooks-reference#subagentstart
- VS Code subagents: https://code.visualstudio.com/docs/agents/run/subagents