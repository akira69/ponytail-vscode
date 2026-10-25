const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'upstream/skills/ponytail/SKILL.md');
const destination = path.join(root, 'skills/ponytail/SKILL.md');
const raw = fs.readFileSync(source, 'utf8');
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
if (!match) throw new Error('Upstream Ponytail skill has invalid frontmatter');
const metadata = YAML.parse(match[1]);
if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || metadata.name !== 'ponytail' || typeof metadata.description !== 'string') {
  throw new Error('Upstream Ponytail skill metadata is invalid');
}
metadata['disable-model-invocation'] = true;
const frontmatter = YAML.stringify(metadata).trimEnd();
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `---\n${frontmatter}\n---\n${match[2]}`, 'utf8');
