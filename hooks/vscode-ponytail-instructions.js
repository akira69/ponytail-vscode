const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./ponytail-config.js');
const { filterSkillBodyForMode, getFallbackInstructions } = require('./ponytail-instructions.js');

const skillPath = path.join(__dirname, '..', 'vscode', 'skills', 'ponytail', 'SKILL.md');

function getPonytailInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;
  if (configuredMode === 'review') return 'PONYTAIL MODE ACTIVE — level: review. Behavior defined by /ponytail-review skill.';

  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;
  try {
    return 'PONYTAIL MODE ACTIVE — level: ' + effectiveMode + '\n\n' +
      filterSkillBodyForMode(fs.readFileSync(skillPath, 'utf8'), effectiveMode);
  } catch {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = { getPonytailInstructions };