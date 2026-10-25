const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const allowed = new Set(['source', 'release', 'commit', 'destination', 'manifest']);
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !allowed.has(key) || i + 1 >= argv.length) throw new Error(`Invalid argument: ${argv[i]}`);
    args[key] = argv[i + 1];
  }
  for (const required of ['source', 'release', 'commit']) if (!args[required]) throw new Error(`Missing --${required}`);
  return args;
}

function within(base, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[a-zA-Z]:/.test(relative)) {
    throw new Error(`Invalid ${label} path: ${relative}`);
  }
  const resolved = path.resolve(base, relative);
  const rel = path.relative(base, resolved);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error(`${label} path escapes its root: ${relative}`);
  return resolved;
}

function git(source, ...args) {
  return execFileSync('git', ['--literal-pathspecs', '-C', source, ...args], { encoding: 'utf8' }).trim();
}

function readCommittedBlob(source, commit, gitPath) {
  const entry = execFileSync('git', ['--literal-pathspecs', '-C', source, 'ls-tree', '-z', commit, '--', gitPath], { encoding: 'utf8' });
  const records = entry.split('\0').filter(Boolean);
  const match = records.length === 1 && /^(\d+) (\w+) [a-f0-9]+\t(.*)$/s.exec(records[0]);
  if (!match || match[3] !== gitPath) throw new Error(`Missing source file at commit: ${gitPath}`);
  if (match[2] !== 'blob' || !['100644', '100755'].includes(match[1])) throw new Error(`Source is not a regular file (mode ${match[1]}, e.g. symlink): ${gitPath}`);
  return execFileSync('git', ['--literal-pathspecs', '-C', source, 'show', `${commit}:${gitPath}`], { maxBuffer: 64 * 1024 * 1024 });
}

// Rejects symlinks at the root, each existing parent below it, and the target itself.
function assertNoSymlinks(base, target) {
  const segments = path.relative(base, target).split(path.sep).filter(Boolean);
  let current = base;
  for (let i = -1; i < segments.length; i++) {
    if (i >= 0) current = path.join(current, segments[i]);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error(`Destination contains a symlink: ${current}`);
    const isFileTarget = i === segments.length - 1 && i >= 0;
    if (isFileTarget ? stat.isDirectory() : !stat.isDirectory()) throw new Error(`Destination has an unexpected entry type: ${current}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!/^v\d+\.\d+\.\d+$/.test(args.release)) throw new Error(`Invalid release: ${args.release}`);
  if (!/^[a-f0-9]{40}$/.test(args.commit)) throw new Error(`Invalid commit: ${args.commit}`);

  const source = path.resolve(args.source);
  const destination = path.resolve(args.destination || root);
  const manifestPath = path.resolve(args.manifest || path.join(root, 'upstream.json'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.repository !== 'https://github.com/DietrichGebert/ponytail.git') throw new Error('Manifest repository is not the approved upstream');
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) throw new Error('Manifest has no assets');

  if (git(source, 'remote', 'get-url', 'origin') !== manifest.repository) throw new Error('Source origin does not match the approved upstream repository');
  if (git(source, 'rev-parse', 'HEAD') !== args.commit) throw new Error('Source checkout is not at the requested commit');
  let tagCommit;
  try {
    tagCommit = git(source, 'rev-parse', '--verify', '--quiet', `refs/tags/${args.release}^{commit}`);
  } catch {
    throw new Error(`Release tag ${args.release} not found in source`);
  }
  if (tagCommit !== args.commit) throw new Error(`Release tag ${args.release} does not point at the requested commit`);

  const seen = new Set();
  const manifestTarget = path.join(destination, 'upstream.json');
  assertNoSymlinks(destination, destination);
  assertNoSymlinks(destination, manifestTarget);
  const plan = manifest.assets.map((asset) => {
    const from = within(source, asset.source, 'source');
    const to = within(destination, asset.destination, 'destination');
    if (seen.has(to)) throw new Error(`Duplicate destination: ${asset.destination}`);
    seen.add(to);
    assertNoSymlinks(destination, to);
    const gitPath = path.relative(source, from).split(path.sep).join('/');
    return { asset, to, data: readCommittedBlob(source, args.commit, gitPath) };
  });

  const assetSha256 = {};
  for (const { asset, to, data } of plan) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data);
    assetSha256[asset.destination] = crypto.createHash('sha256').update(data).digest('hex');
  }
  const updated = { ...manifest, release: args.release, commit: args.commit, assetSha256 };
  fs.writeFileSync(manifestTarget, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log(`Synced ${plan.length} assets from ${args.release} (${args.commit})`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
