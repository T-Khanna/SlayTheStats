// POC scope: keep only the latest 3 single-player runs per character.
// Single-player == meta.player_count === 1.

export function pocSlice(runs) {
  const singles = runs
    .filter((r) => (r.meta?.player_count ?? r.players?.length ?? 0) === 1)
    .slice()
    .sort((a, b) => (b.meta?.start_time ?? 0) - (a.meta?.start_time ?? 0));

  const perChar = new Map();
  for (const run of singles) {
    const char = run.players?.[0]?.character ?? 'UNKNOWN';
    if (!perChar.has(char)) perChar.set(char, []);
    const bucket = perChar.get(char);
    if (bucket.length < 3) bucket.push(run);
  }

  const result = [];
  for (const bucket of perChar.values()) result.push(...bucket);
  return result;
}
