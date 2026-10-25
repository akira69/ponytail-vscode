const fs = require('node:fs');
const path = require('node:path');
const { getPonytailInstructions } = require('../hooks/ponytail-instructions.js');

const outputDir = path.resolve(__dirname, '../generated/instructions');
fs.mkdirSync(outputDir, { recursive: true });
const hostNote = 'In VS Code, use the Ponytail status-bar item or `Ponytail: Set Mode` to change the persistent mode. Invoking `/ponytail lite`, `/ponytail full`, or `/ponytail ultra` does not change extension state.';
for (const mode of ['lite', 'full', 'ultra']) {
  const frontmatter = `---\nname: ponytail-${mode}\ndescription: Ponytail ${mode} coding guidance.\napplyTo: "**"\n---\n\n`;
  fs.writeFileSync(path.join(outputDir, `ponytail-${mode}.instructions.md`), frontmatter + hostNote + '\n\n' + getPonytailInstructions(mode).trimEnd() + '\n');
}
