// Lightweight, lazy display-name resolver.
//
// Built from data/display_names.json (1205 entries across 10 categories).
// Resolves IDs at render time — does NOT mutate run objects.
//
// Usage:
//   const resolver = createResolver(displayNamesJson);
//   resolver.name('character', 'NECROBINDER')   -> 'Necrobinder'
//   resolver.name('encounter', 'GremlinNob')    -> 'Gremlin Nob'
//   resolver.card('NOXIOUS_FUMES+1')            -> 'Noxious Fumes+'
//   resolver.cards(['STRIKE_DEFECT', ...])      -> ['Strike Defect', ...]

const CARD_UPGRADE_RE = /^([A-Z0-9_]+)\+(\d+)$/;

export function createResolver(displayNames) {
  const tables = displayNames || {};

  function name(category, id) {
    if (typeof id !== 'string' || !id) return id ?? '';
    const table = tables[category];
    if (!table) return id;
    return table[id] ?? id;
  }

  function card(id) {
    if (typeof id !== 'string' || !id) return id ?? '';
    const m = CARD_UPGRADE_RE.exec(id);
    if (m) {
      const base = tables.card?.[m[1]];
      return base ? `${base}+` : id;
    }
    return tables.card?.[id] ?? id;
  }

  function names(category, ids) {
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => name(category, id));
  }

  function cards(ids) {
    if (!Array.isArray(ids)) return [];
    return ids.map(card);
  }

  return { name, names, card, cards };
}

export function emptyResolver() {
  return createResolver({});
}
