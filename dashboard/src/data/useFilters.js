// useFilters — shared filter state and filtered-run derivation.
// Returns { filters, setFilter, filteredRuns }
// Consumed by any view that wants to respect user filters.

import { useMemo, useState } from 'react';
import { useRunData } from './RunDataContext.jsx';

const DEFAULT_FILTERS = {
  characters: [],      // [] = all
  outcome: 'all',      // 'all' | 'win' | 'loss'
  ascMin: 0,
  ascMax: 20,
};

export function useFilters() {
  const { pocRuns } = useRunData();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filteredRuns = useMemo(() => {
    return pocRuns.filter((run) => {
      const player = run.players?.[0];
      const char = player?.character ?? '';
      const win = run.meta?.win ?? false;
      const asc = run.meta?.ascension ?? 0;

      if (filters.characters.length > 0 && !filters.characters.includes(char)) return false;
      if (filters.outcome === 'win' && !win) return false;
      if (filters.outcome === 'loss' && win) return false;
      if (asc < filters.ascMin || asc > filters.ascMax) return false;
      return true;
    });
  }, [pocRuns, filters]);

  return { filters, setFilter, filteredRuns };
}
