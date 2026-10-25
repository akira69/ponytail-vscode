import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';

const isTestMode = process.argv.includes('--tests');

const baseConfig = {
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  bundle: true,
  external: ['vscode'],
};

if (isTestMode) {
  // Build test suite index
  await esbuild.build({
    ...baseConfig,
    entryPoints: ['test/suite/index.ts'],
    outfile: 'out/test/suite/index.js',
  });

  // Build individual test files
  const testFiles = fs.readdirSync('test/suite').filter(f => f.endsWith('.test.ts'));
  for (const file of testFiles) {
    const input = path.join('test/suite', file);
    const output = path.join('out/test/suite', file.replace('.ts', '.js'));
    await esbuild.build({
      ...baseConfig,
      entryPoints: [input],
      outfile: output,
    });
  }
} else {
  // Build extension
  await esbuild.build({
    ...baseConfig,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
  });
}
