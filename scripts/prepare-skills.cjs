const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const controlParagraph = 'Active for the whole session until the user says "stop ponytail" or "normal mode". Switch level: `/ponytail lite|full|ultra`.';
const hostControls = 'In VS Code, use the Ponytail status-bar item or `Ponytail: Set Mode` to change the persistent mode. Invoking `/ponytail lite`, `/ponytail full`, or `/ponytail ultra` does not change extension state. Chat requests to stop or switch Ponytail do not change the saved setting; explain the control instead of claiming it changed. Off disables automatic guidance on future requests, but cannot remove earlier chat context.\n\nWhen delegating, include the active Ponytail level and guidance in the task, especially for the built-in `general-purpose` subagent, which does not emit the subagent-start hook.';

function prepareSkill(name, raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`Upstream ${name} has invalid frontmatter`);
  const metadata = YAML.parse(match[1]);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || metadata.name !== name || typeof metadata.description !== 'string') {
    throw new Error(`Upstream ${name} metadata is invalid`);
  }
  let body = match[2];
  if (name === 'ponytail') {
    if (body.split(controlParagraph).length !== 2) throw new Error('Upstream control paragraph changed; review the VS Code adaptation');
    body = body.replace(controlParagraph, hostControls);
    metadata['disable-model-invocation'] = true;
    delete metadata['argument-hint'];
  } else if (name === 'ponytail-help') {
    body = '\n' + fs.readFileSync(path.join(root, 'resources/ponytail-help.md'), 'utf8');
  } else {
    throw new Error(`No host adaptation for ${name}`);
  }
  return `---\n${YAML.stringify(metadata).trimEnd()}\n---\n${body}`;
}

if (require.main === module) {
  const prepared = ['ponytail', 'ponytail-help'].map((name) => ({ name, text: prepareSkill(name, fs.readFileSync(path.join(root, `upstream/skills/${name}/SKILL.md`), 'utf8')) }));
  for (const { name, text } of prepared) {
    const destination = path.join(root, `skills/${name}/SKILL.md`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, text, 'utf8');
  }
}

module.exports = { prepareSkill };
