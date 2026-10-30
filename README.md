# Ponytail Copilot Sync

<img src="media/ponytail-integration.png" alt="Community integration icon based on upstream Ponytail artwork, with editor and plug badges" width="128">

**DietrichGebert's Ponytail coding guidance, packaged for GitHub Copilot in Visual Studio Code.** Choose a persistent guidance level, use the bundled review skills, and encourage smaller, maintainable changes.

## Why this extension exists

[Ponytail](https://github.com/DietrichGebert/ponytail) is DietrichGebert's project. The original prompts, coding approach, skills, and artwork come from upstream; credit belongs to their creators.

This community integration makes that work convenient to install and use in GitHub Copilot in VS Code. Our contribution is the editor packaging, mode selector, host-specific instructions, and maintenance of reviewed upstream updates. It is independently maintained by [akira69](https://github.com/akira69/ponytail-vscode), published as `Finch13`, and is not an official upstream or Microsoft release.

Ponytail encourages the agent to understand the code, reuse what exists, and make the smallest complete change while retaining validation, error handling, security, and meaningful tests. It supplies instructions, not a separate AI model or a guarantee of model behavior.

## Get started

1. Install **Ponytail Copilot Sync** from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Finch13.ponytail-dietrichgebert-sync).
2. Open a project in VS Code **1.142.0 or later**, with GitHub Copilot chat available.
3. Click **Ponytail: FULL** in the status bar, or run **Ponytail: Set Mode** from the Command Palette.
4. Choose a mode, then use Copilot chat as usual. For example: “Review this change for correctness and unnecessary complexity.”

No separate Ponytail API key or service is required. Copilot has its own access requirements. The extension bundles its guidance locally and does not download prompts at runtime; Copilot itself still needs its normal model connection.

## Choose a mode

| Mode | Guidance |
| --- | --- |
| **Lite** | Build the requested change and mention a simpler option. |
| **Full** | Make the smallest complete change and check meaningful logic. The default. |
| **Ultra** | Also question whether the requested work needs to exist. |
| **Off** | Stop automatically adding Ponytail guidance to future requests. |

Your selection persists for the workspace. Multiple windows observe mode changes; multi-root windows currently use the first folder. Changing mode through a chat message or `/ponytail` does **not** change the saved setting. Off cannot remove instructions already in chat history; start a new chat when you need a clean context.

## Why no `@ponytail` or dedicated Ponytail agent?

Ponytail supplies guidance to the Copilot agent you already use. Selecting Lite, Full, or Ultra enables the corresponding chat instructions automatically in supported Copilot chat. You do not need to switch agents or type `/ponytail` before every request.

- **`/ponytail`** explicitly loads the core skill into the current conversation. Other slash skills, such as `/ponytail-review`, request a specific workflow. They do not change the saved mode. See [skills as slash commands](https://code.visualstudio.com/docs/agent-customization/agent-skills#use-skills-as-slash-commands).
- **`@ponytail`** would address a separate chat participant, which this extension does not register. Microsoft has deprecated extension-provided chat participants: they are unsupported in the newer Copilot harness and retained only for Local-harness compatibility. See [Microsoft's migration guidance](https://code.visualstudio.com/docs/agent-customization/migrate-customizations#replace-chat-participants).
- **A dedicated Ponytail agent** would be another role in the Agent dropdown. That is useful when a workflow needs its own tools or model, but ordinary Ponytail guidance does not: the selected mode adds it to your existing workflow. An extra general-purpose agent would duplicate that role and add another selection to maintain.

The optional reviewer and researcher agents below serve focused roles; neither is required to use Ponytail's persistent guidance.

## Included skills

| Skill | Use it for |
| --- | --- |
| `/ponytail` | The core minimal, maintainable coding approach. |
| `/ponytail-review` | Review a change for correctness, security, tests, performance, and complexity. |
| `/ponytail-audit` | Examine the whole repository and rank actionable findings. |
| `/ponytail-debt` | List deliberate shortcuts and deferred work. |
| `/ponytail-gain` | Show upstream benchmark results, not measurements of this extension. |
| `/ponytail-help` | Explain controls, scope, and usage. |

The extension also contributes `ponytail-reviewer` and `ponytail-researcher` custom agents.

## Optional subagent guidance

The extension alone provides the controls, skills, custom agents, and mode-specific chat instructions. Automatic guidance when eligible subagents start requires installing [this repository](https://github.com/akira69/ponytail-vscode) separately as a **GitHub Copilot Agent Plugin** through Copilot's plugin manager.

That optional hook requires Node.js on PATH and plugin hooks enabled in a supported, trusted Copilot environment; organization policy may restrict it. The built-in `general-purpose` subagent does not emit the start hook, so the parent must pass the guidance explicitly. The prepared prompts include that reminder.

This integration does not include upstream's Claude Code band, cost dashboard, or Claude-specific control commands.

## Updates, support, and attribution

A daily workflow checks upstream releases and proposes tested updates for maintainer review. Installed copies receive those changes only after a new extension version is published; enable VS Code extension auto-update if desired. Sideloaded VSIX packages and the optional Agent Plugin have separate update paths.

- **Original Ponytail:** [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail).
- **Integration issues:** [akira69/ponytail-vscode/issues](https://github.com/akira69/ponytail-vscode/issues).
- **Release notes:** [CHANGELOG](CHANGELOG.md).
- **Build, provenance, and release process:** [maintainer guide](docs/MAINTAINING.md).
- **License and artwork credit:** [MIT license](LICENSE) and [third-party notices](THIRD-PARTY-NOTICES.md).

Raw upstream core/help sources are retained and verified by checksum. `upstream.json` records the imported release, commit, and checksums. The package includes `UPSTREAM-README.md` verbatim for reference; it also describes features for other hosts that this extension does not provide. A small, checked build adaptation supplies truthful VS Code controls while preserving the coding rules. Upstream benchmark figures are not promised results for Copilot; live model behavior depends on the host, model, and task.
