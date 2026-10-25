const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const errors = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const frontmatterName = (text) => (text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/) || [])[1]?.match(/^name:\s*(.+)$/m)?.[1].trim();

const plugin = json('plugin.json');
if (!/^https:\/\/agent-plugins\.org\/schemas\/1\.0\.0\//.test(plugin.$schema || '')) errors.push('plugin.json: missing Agent Plugins 1.0 $schema');
if (plugin.name !== 'ponytail-vscode') errors.push('plugin.json: name must be ponytail-vscode');
if (plugin.version !== json('package.json').version) errors.push('plugin.json: version must match package.json');

const hooks = json('com.github.copilot/hooks/hooks.json').hooks || {};
for (const [event, entries] of Object.entries(hooks)) {
  for (const entry of entries) {
    const match = /\$\{PLUGIN_ROOT\}\/([^"]+)/.exec(entry.command || '');
    if (!match) errors.push(`hooks.json: ${event} command has no \${PLUGIN_ROOT} path`);
    else if (!fs.existsSync(path.join(root, match[1]))) errors.push(`hooks.json: ${event} path not found: ${match[1]}`);
  }
}

const agentDir = path.join(root, 'com.github.copilot', 'agents');
for (const file of fs.readdirSync(agentDir).filter((f) => f.endsWith('.agent.md'))) {
  const name = frontmatterName(fs.readFileSync(path.join(agentDir, file), 'utf8'));
  if (name !== file.replace(/\.agent\.md$/, '')) errors.push(`agents/${file}: frontmatter name "${name}" does not match filename`);
}

const skills = ['ponytail', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help', 'ponytail-review'];
for (const skill of skills) {
  const file = path.join('skills', skill, 'SKILL.md');
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: missing`);
  else if (frontmatterName(read(file)) !== skill) errors.push(`${file}: frontmatter name must be ${skill}`);
}

const license = read('LICENSE');
if (!license.startsWith('MIT License') || !license.includes('Permission is hereby granted, free of charge')) errors.push('LICENSE: full MIT license missing');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Plugin check passed');
