// Phase 2: all single-player runs, no per-character cap.
// Single-player == meta.player_count === 1.

export function pocSlice(runs) {
  return runs.filter((r) => (r.meta?.player_count ?? r.players?.length ?? 0) === 1);
}
