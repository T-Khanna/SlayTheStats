import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadEverything } from './runLoader.js';
import { createResolver, emptyResolver } from './nameResolver.js';
import { pocSlice } from './pocSlice.js';

const RunDataContext = createContext(null);

export function RunDataProvider({ children }) {
  const [state, setState] = useState({
    status: 'loading',
    error: null,
    displayNames: null,
    manifest: [],
    allRuns: [],
    pocRuns: [],
  });

  useEffect(() => {
    let cancelled = false;
    loadEverything()
      .then(({ displayNames, manifest, runs }) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          error: null,
          displayNames,
          manifest,
          allRuns: runs,
          pocRuns: pocSlice(runs),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, status: 'error', error: err }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolver = useMemo(
    () => (state.displayNames ? createResolver(state.displayNames) : emptyResolver()),
    [state.displayNames],
  );

  const value = useMemo(() => ({ ...state, resolver }), [state, resolver]);
  return <RunDataContext.Provider value={value}>{children}</RunDataContext.Provider>;
}

export function useRunData() {
  const ctx = useContext(RunDataContext);
  if (!ctx) throw new Error('useRunData must be used within <RunDataProvider>');
  return ctx;
}
