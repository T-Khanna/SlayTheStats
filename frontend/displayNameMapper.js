// Client-side helpers for mapping simplified run IDs to display names.
//
// Usage:
//   import { decorateRunWithNames } from './displayNameMapper.js';
//   const viewModel = decorateRunWithNames(runJson, displayNamesJson);
//
// This keeps source run data compact (ID-only) and applies names only where needed.

const CARD_UPGRADE_RE = /^([A-Z0-9_]+)\+(\d+)$/;

function mapId(displayNames, category, value) {
  if (typeof value !== 'string') {
    return null;
  }

  const mapping = displayNames?.[category];
  if (!mapping || typeof mapping !== 'object') {
    return null;
  }

  if (category === 'card') {
    const m = CARD_UPGRADE_RE.exec(value);
    if (m) {
      const baseName = mapping[m[1]];
      return baseName ? `${baseName}+` : null;
    }
  }

  return mapping[value] || null;
}

function addNamedField(target, field, category, displayNames) {
  const name = mapId(displayNames, category, target?.[field]);
  if (name) {
    target[`${field}_name`] = name;
  }
}

function addNamedListField(target, field, category, displayNames) {
  const values = target?.[field];
  if (!Array.isArray(values)) {
    return;
  }

  target[`${field}_names`] = values.map((value) => {
    const name = mapId(displayNames, category, value);
    return name || value;
  });
}

function addNamedScalarOrList(target, field, category, displayNames) {
  const value = target?.[field];
  if (typeof value === 'string') {
    addNamedField(target, field, category, displayNames);
  } else if (Array.isArray(value)) {
    addNamedListField(target, field, category, displayNames);
  }
}

export function decorateRunWithNames(run, displayNames) {
  const copy = JSON.parse(JSON.stringify(run));

  const meta = copy.meta || {};
  addNamedListField(meta, 'acts', 'act', displayNames);
  addNamedField(meta, 'killed_by', 'encounter', displayNames);

  if (meta.killed_at && typeof meta.killed_at === 'object') {
    addNamedField(meta.killed_at, 'id', 'encounter', displayNames);
  }

  for (const player of copy.players || []) {
    addNamedField(player, 'character', 'character', displayNames);
    addNamedListField(player, 'deck', 'card', displayNames);
    addNamedListField(player, 'relics', 'relic', displayNames);
    addNamedListField(player, 'potions', 'potion', displayNames);
  }

  for (const node of copy.nodes || []) {
    addNamedField(node, 'encounter', 'encounter', displayNames);
    addNamedField(node, 'event', 'event', displayNames);
    addNamedListField(node, 'monsters', 'monster', displayNames);

    for (const p of node.players || []) {
      addNamedField(p, 'card_picked', 'card', displayNames);
      addNamedListField(p, 'cards_skipped', 'card', displayNames);
      addNamedListField(p, 'cards_gained', 'card', displayNames);
      addNamedListField(p, 'cards_removed', 'card', displayNames);
      addNamedListField(p, 'cards_upgraded', 'card', displayNames);
      addNamedListField(p, 'cards_downgraded', 'card', displayNames);

      for (const item of p.cards_transformed || []) {
        addNamedField(item, 'from', 'card', displayNames);
        addNamedField(item, 'to', 'card', displayNames);
      }

      for (const item of p.cards_enchanted || []) {
        addNamedField(item, 'card', 'card', displayNames);
      }

      addNamedField(p, 'relic_picked', 'relic', displayNames);
      addNamedListField(p, 'relics_skipped', 'relic', displayNames);
      addNamedListField(p, 'relics_bought', 'relic', displayNames);
      addNamedListField(p, 'relics_lost', 'relic', displayNames);

      addNamedListField(p, 'potions_picked', 'potion', displayNames);
      addNamedListField(p, 'potions_skipped', 'potion', displayNames);
      addNamedListField(p, 'potions_bought', 'potion', displayNames);
      addNamedListField(p, 'potions_used', 'potion', displayNames);
      addNamedListField(p, 'potions_discarded', 'potion', displayNames);

      addNamedListField(p, 'colorless_bought', 'card', displayNames);
      addNamedScalarOrList(p, 'rest_choice', 'rest_choice', displayNames);
      addNamedScalarOrList(p, 'event_choice', 'event', displayNames);
      addNamedField(p, 'neow_choice', 'neow', displayNames);
      addNamedListField(p, 'neow_skipped', 'neow', displayNames);
    }
  }

  return copy;
}

export function getDisplayName(displayNames, category, id) {
  return mapId(displayNames, category, id);
}
