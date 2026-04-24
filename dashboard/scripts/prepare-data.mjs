// Builds dashboard/public/data/ from the project root data/ and out/simplified/.
// Runs automatically before `npm run dev` and `npm run build` via package.json hooks.
//
// Output:
//   public/data/display_names.json
//   public/data/runs/<timestamp>.simplified.json
//   public/data/runs/index.json     <-- manifest with light metadata for filtering

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const srcDataDir = path.join(projectRoot, 'data');
const srcRunsDir = path.join(projectRoot, 'out', 'simplified');
const dstDataDir = path.resolve(__dirname, '..', 'public', 'data');
const dstRunsDir = path.join(dstDataDir, 'runs');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyJson(src, dst) {
  const text = await fs.readFile(src, 'utf8');
  await fs.writeFile(dst, text, 'utf8');
}

async function buildRunsManifest() {
  const entries = await fs.readdir(srcRunsDir);
  const runFiles = entries
    .filter((f) => f.endsWith('.simplified.json'))
    .sort();

  const manifest = [];
  for (const file of runFiles) {
    const srcPath = path.join(srcRunsDir, file);
    const dstPath = path.join(dstRunsDir, file);
    await copyJson(srcPath, dstPath);

    const raw = await fs.readFile(srcPath, 'utf8');
    const run = JSON.parse(raw);
    const meta = run.meta ?? {};
    const players = run.players ?? [];

    manifest.push({
      file,
      run_id: file.replace(/\.simplified\.json$/, ''),
      start_time: meta.start_time ?? null,
      duration: meta.duration ?? null,
      ascension: meta.ascension ?? null,
      win: meta.win ?? null,
      abandoned: meta.abandoned ?? null,
      player_count: meta.player_count ?? players.length,
      acts: meta.acts ?? [],
      characters: players.map((p) => p.character),
    });
  }

  manifest.sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));
  await fs.writeFile(
    path.join(dstRunsDir, 'index.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  return manifest.length;
}

async function main() {
  await ensureDir(dstDataDir);
  await ensureDir(dstRunsDir);

  await copyJson(
    path.join(srcDataDir, 'display_names.json'),
    path.join(dstDataDir, 'display_names.json'),
  );

  const count = await buildRunsManifest();
  console.log(`prepare-data: copied ${count} runs + display_names.json into public/data/`);
}

main().catch((err) => {
  console.error('prepare-data failed:', err);
  process.exitCode = 1;
});
