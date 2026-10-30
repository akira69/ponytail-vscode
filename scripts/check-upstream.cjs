const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { prepareSkill } = require('./prepare-skills.cjs');

const root = path.resolve(__dirname, '..');
const skillNames = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function parseSkill(relative) {
  const match = frontmatterPattern.exec(read(relative));
  if (!match) { errors.push(`${relative}: invalid frontmatter`); return undefined; }
  try { return { metadata: YAML.parse(match[1]) || {}, body: match[2] }; } catch (error) { errors.push(`${relative}: ${error.message}`); return undefined; }
}

let pin;
try { pin = JSON.parse(read('upstream.json')); } catch (error) { errors.push(`upstream.json: ${error.message}`); }

if (pin) {
  check(pin.repository === 'https://github.com/DietrichGebert/ponytail.git', 'repository is not the approved upstream');
  check(/^v\d+\.\d+\.\d+$/.test(pin.release), 'release is not a version tag');
  check(/^[a-f0-9]{40}$/.test(pin.commit), 'commit is not a 40-character hash');
  check(Array.isArray(pin.assets) && pin.assets.length > 0, 'assets list is missing');
  const destinations = (pin.assets || []).map((asset) => asset.destination);
  const safe = [];
  const seen = new Set();
  const confined = (value) => {
    if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value) || /^[a-zA-Z]:/.test(value)) return undefined;
    const rel = path.relative(root, path.resolve(root, value));
    return !rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel) ? undefined : rel;
  };
  for (const [index, asset] of (pin.assets || []).entries()) {
    const rel = confined(asset && asset.destination);
    if (!confined(asset && asset.source)) errors.push(`assets[${index}]: invalid or escaping source path: ${JSON.stringify(asset && asset.source)}`);
    if (rel === undefined) {
      errors.push(`assets[${index}]: invalid or escaping destination path: ${JSON.stringify(asset && asset.destination)}`);
    } else if (seen.has(rel)) {
      errors.push(`assets[${index}]: duplicate destination: ${asset.destination}`);
    } else {
      seen.add(rel);
      safe.push(asset.destination);
    }
  }
  check(JSON.stringify(Object.keys(pin.assetSha256 || {}).sort()) === JSON.stringify([...destinations].sort()), 'assetSha256 keys do not match asset destinations');
  for (const destination of safe) {
    const file = path.join(root, destination);
    if (!fs.existsSync(file)) { errors.push(`${destination}: missing`); continue; }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    check(actual === (pin.assetSha256 || {})[destination], `${destination}: SHA-256 mismatch`);
  }
}

for (const name of skillNames) {
  const relative = `skills/${name}/SKILL.md`;
  if (!fs.existsSync(path.join(root, relative))) { errors.push(`${relative}: missing`); continue; }
  const skill = parseSkill(relative);
  if (skill) check(skill.metadata.name === name, `${relative}: name does not match folder`);
}

for (const name of ['ponytail', 'ponytail-help']) {
  try {
    const expected = prepareSkill(name, read(`upstream/skills/${name}/SKILL.md`));
    check(read(`skills/${name}/SKILL.md`) === expected, `${name}: packaged skill differs from the checked VS Code adaptation`);
  } catch (error) {
    errors.push(`${name}: ${error.message}`);
  }
}

if (fs.existsSync(path.join(root, 'LICENSE'))) {
  const license = read('LICENSE');
  check(/MIT License/.test(license), 'LICENSE is missing MIT License title');
  check(/Copyright \(c\) \d{4} DietrichGebert/.test(license), 'LICENSE is missing upstream copyright');
  check(/THE SOFTWARE IS PROVIDED "AS IS"/.test(license), 'LICENSE is missing warranty disclaimer');
} else {
  errors.push('LICENSE: missing');
}

if (errors.length) {
  console.error(errors.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}
console.log('Upstream assets verified');
