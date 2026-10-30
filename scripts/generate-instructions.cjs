const fs = require('node:fs');
const path = require('node:path');
const { getPonytailInstructions } = require('../hooks/ponytail-instructions.js');

const outputDir = path.resolve(__dirname, '../generated/instructions');
fs.mkdirSync(outputDir, { recursive: true });
for (const mode of ['lite', 'full', 'ultra']) {
  const frontmatter = `---\nname: ponytail-${mode}\ndescription: Ponytail ${mode} coding guidance.\napplyTo: "**"\n---\n\n`;
  fs.writeFileSync(path.join(outputDir, `ponytail-${mode}.instructions.md`), frontmatter + getPonytailInstructions(mode).trimEnd() + '\n');
}
