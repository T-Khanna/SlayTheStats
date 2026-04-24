// Loads the run manifest, all run files, and display_names.json.
// Static fetches against /data/ which is populated by scripts/prepare-data.mjs.

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function loadDisplayNames() {
  return fetchJson(`${DATA_BASE}/display_names.json`);
}

export async function loadRunManifest() {
  return fetchJson(`${DATA_BASE}/runs/index.json`);
}

export async function loadRun(file) {
  return fetchJson(`${DATA_BASE}/runs/${file}`);
}

export async function loadAllRuns(manifest) {
  return Promise.all(manifest.map((entry) => loadRun(entry.file)));
}

export async function loadEverything() {
  const [displayNames, manifest] = await Promise.all([
    loadDisplayNames(),
    loadRunManifest(),
  ]);
  const runs = await loadAllRuns(manifest);
  // Stitch manifest entries onto the run objects for convenience.
  runs.forEach((run, i) => {
    run.__file = manifest[i].file;
    run.__run_id = manifest[i].run_id;
  });
  return { displayNames, manifest, runs };
}
