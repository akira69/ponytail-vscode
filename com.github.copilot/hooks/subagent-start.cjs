const fs = require('node:fs');
const { getEffectiveMode } = require('../../shared/mode-state.cjs');
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions.js');

// Guidance only: any failure emits {} so delegation is never blocked.
try {
  const input = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
  const event = JSON.parse(input);
  if (!event || typeof event.cwd !== 'string' || typeof event.agentName !== 'string') {
    fs.writeSync(1, '{}');
  } else {
    const mode = getEffectiveMode(event.cwd);
    fs.writeSync(1, mode === 'off' ? '{}' : JSON.stringify({ additionalContext: getPonytailInstructions(mode) }));
  }
} catch (error) {
  fs.writeSync(2, `${error.message}\n`);
  fs.writeSync(1, '{}');
}
