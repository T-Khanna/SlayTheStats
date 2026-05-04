import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

async function resolveHistoryDir() {
  if (process.env.STS2_HISTORY_DIR) return process.env.STS2_HISTORY_DIR;

  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error('APPDATA is not set. Set STS2_HISTORY_DIR to your Slay the Spire 2 history folder.');
  }

  const steamRoot = path.join(appData, 'SlayTheSpire2', 'steam');
  const steamEntries = await fs.readdir(steamRoot, { withFileTypes: true });
  const accountDirs = steamEntries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  for (const account of accountDirs) {
    const accountPath = path.join(steamRoot, account);
    let profileEntries;
    try {
      profileEntries = await fs.readdir(accountPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const profileDirs = profileEntries
      .filter((e) => e.isDirectory() && e.name.startsWith('profile'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    for (const profile of profileDirs) {
      const historyPath = path.join(accountPath, profile, 'saves', 'history');
      try {
        const files = await fs.readdir(historyPath);
        if (files.some((f) => f.endsWith('.run'))) return historyPath;
      } catch {
        // Keep scanning other profiles/accounts.
      }
    }
  }

  throw new Error('Could not locate STS2 history directory automatically. Set STS2_HISTORY_DIR to your history folder path.');
}

// Parse --count N from argv (default 1; pass --all to ingest every unparsed run)
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return Infinity;
  const idx = args.indexOf('--count');
  if (idx !== -1 && args[idx + 1]) return Number.parseInt(args[idx + 1], 10);
  return 1;
}

function runOrThrow(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

async function alreadyParsed(base) {
  const outFile = path.join(projectRoot, 'out', 'simplified', `${base}.simplified.json`);
  try {
    await fs.access(outFile);
    return true;
  } catch {
    return false;
  }
}

async function pickRuns(dir, count) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const runFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.run'))
    .map((e) => e.name);

  // Sort newest-first by numeric timestamp stem
  runFiles.sort((a, b) => {
    const aNum = Number.parseInt(path.basename(a, '.run'), 10);
    const bNum = Number.parseInt(path.basename(b, '.run'), 10);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return bNum - aNum;
    return b.localeCompare(a);
  });

  // Take newest N that haven't been parsed yet
  const result = [];
  for (const file of runFiles) {
    if (result.length >= count) break;
    const base = path.basename(file, '.run');
    if (!(await alreadyParsed(base))) result.push(file);
  }
  return result;
}

async function main() {
  const count = parseArgs();
  const historyDir = await resolveHistoryDir();

  const runs = await pickRuns(historyDir, count);
  if (runs.length === 0) {
    console.log('No new runs to ingest — everything is already parsed.');
    return;
  }

  const outDir = path.join(projectRoot, 'out', 'simplified');
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Ingesting ${runs.length} run(s)...`);
  for (const file of runs) {
    const base = path.basename(file, '.run');
    const inputPath = path.join(historyDir, file);
    const outFile = path.join(outDir, `${base}.simplified.json`);
    runOrThrow('python', ['parse_run.py', '--output', outFile, inputPath], projectRoot);
  }

  console.log('Refreshing dashboard data...');
  runOrThrow('node', ['scripts/prepare-data.mjs'], path.resolve(projectRoot, 'dashboard'));

  console.log(`Done. ${runs.length} run(s) ingested and dashboard data refreshed.`);
}

main().catch((err) => {
  console.error('ingest-latest failed:', err.message);
  process.exit(1);
});
