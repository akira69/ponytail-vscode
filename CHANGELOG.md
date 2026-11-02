# Changelog

## 0.1.4

- Move the six extension skills out of the Agent Plugin discovery folder to prevent duplicate Copilot skills when both packages are installed.
- Preserve optional subagent guidance using the extension-only core skill path, and clarify that both extension and plugin need updates to remove old duplicates.
- Keep the scheduled upstream workflow aligned with the CI dependency-audit policy.

## 0.1.3

- Keep the reviewer and researcher agents in the VS Code extension only, avoiding duplicate Agent dropdown entries when the optional Agent Plugin is installed.
- Clarify that the optional Agent Plugin adds subagent-start guidance, not custom agents.

## 0.1.2

- Fix mode changes failing with EPERM when Windows state files have the Hidden attribute, preserving file attributes and correctly replacing shorter mode names.
- Replace the geometric status-bar icon with a thin-lined Ponytail face based on the original artwork.
- Exclude temporary browser previews from the packaged extension.

## 0.1.1

- Explain the community integration's purpose and credit DietrichGebert's original Ponytail project at the start of the Marketplace listing.
- Add a quick start, mode descriptions, skill reference, and clear extension versus optional Agent Plugin requirements.
- Add an icon based on upstream Ponytail artwork with generic editor and plug corner badges, with source and license attribution.
- Move build and release details to the maintainer guide. No runtime behavior changes.

## 0.1.0

- Initial Marketplace release: persistent Off/Lite/Full/Ultra controls, bundled Ponytail skills and chat instructions, and a separate Copilot Agent Plugin for eligible subagents.
- Verify imported upstream assets and propose reviewed release updates through GitHub Actions.
