# Simplified Run Schema

This document describes the JSON schema produced by [parse_run.py](../parse_run.py)
when condensing Slay the Spire 2 `.run` files.

The goals of the simplified format are:

1. **Less verbose.** Most of the size in raw `.run` files comes from
   namespace prefixes, repeated 64-bit Steam IDs, and per-node fields whose
   values never change. Stripping those alone gives a ~75% reduction even
   pretty-printed (and ~87% if minified with `--compact`).
2. **Analytics-friendly.** Aggregate per-player totals are pre-computed; the
   node-level history retains every decision (cards picked/skipped, relics,
   potions, rest choices, events, transforms, upgrades).
3. **Lossless for analytics use cases** (deck composition, encounter outcomes,
   card-pick patterns, run termination).

By default the parser emits **pretty-printed JSON** (2-space indent). Pass
`--compact` for a minified single-line form.

---

## Top-level shape

```jsonc
{
  "meta":    { … run-level metadata … },
  "players": [ { … per-player summary + totals … }, … ],
  "nodes":   [ { … one entry per map node, in chronological order … }, … ]
}
```

All ID strings have their namespace prefix stripped: `CARD.`, `RELIC.`,
`MONSTER.`, `ENCOUNTER.`, `EVENT.`, `POTION.`, `ACT.`, `CHARACTER.`, `ROOM.`.

---

## `meta`

Run-wide metadata.

| Field            | Type             | Description                                                                |
| ---------------- | ---------------- | -------------------------------------------------------------------------- |
| `seed`           | string           | RNG seed (e.g. `"KBRAB2KY6Y"`).                                            |
| `start_time`     | int              | Run start time, Unix epoch seconds.                                        |
| `duration`       | int              | Run duration in seconds.                                                   |
| `ascension`      | int              | Ascension level.                                                           |
| `game_mode`      | string           | Game mode (e.g. `"standard"`).                                             |
| `build_id`       | string           | Game build id (e.g. `"v0.99.1"`).                                          |
| `schema_version` | int              | Source `.run` schema version.                                              |
| `acts`           | string[]         | Ordered list of acts visited (e.g. `["UNDERDOCKS","HIVE","GLORY"]`).       |
| `win`            | bool             | `true` if the run was won.                                                 |
| `abandoned`      | bool             | `true` if the run was abandoned.                                           |
| `killed_by`      | string \| null   | ID of the encounter or event that ended the run, prefix-stripped.          |
| `killed_at`      | object \| null   | Location of the killing node (see below). `null` on wins.                  |
| `player_count`   | int              | Number of players in the run.                                              |

### `meta.killed_at`

Populated only when `win` is `false`.

| Field   | Type   | Description                                                |
| ------- | ------ | ---------------------------------------------------------- |
| `act`   | int    | 1-based act number (1 corresponds to `meta.acts[0]`).      |
| `node`  | int    | 1-based node number within that act.                       |
| `type`  | string | `map_point_type` (`monster`, `elite`, `boss`, `unknown`…). |
| `id`    | string | Encounter / room model id, prefix-stripped.                |

---

## `players`

One entry per player, in stable order. The `index` is reused throughout
`nodes[].players[]` to avoid repeating the 64-bit Steam id on every node.

| Field          | Type     | Description                                                                                |
| -------------- | -------- | ------------------------------------------------------------------------------------------ |
| `index`        | int      | 0-based player index.                                                                      |
| `player_id`    | int      | Steam player id.                                                                           |
| `character`    | string   | Character id (e.g. `"SILENT"`).                                                            |
| `deck`         | string[] | Final deck. Upgraded cards have a `+N` suffix (e.g. `"NOXIOUS_FUMES+1"`).                  |
| `relics`       | string[] | Final relic ids in pickup order.                                                           |
| `potions`      | string[] | Final potions held at end of run.                                                          |
| `max_potions`  | int      | Maximum potion slot count.                                                                 |
| `totals`       | object   | Pre-aggregated stats over the whole run (see below).                                       |

### `players[].totals`

Walked once at parse time so analytics queries don't have to traverse `nodes`.

| Field             | Type | Description                                                                  |
| ----------------- | ---- | ---------------------------------------------------------------------------- |
| `damage_taken`    | int  | Total HP lost across all rooms.                                              |
| `healed`          | int  | Total HP healed across all rooms.                                            |
| `gold_earned`     | int  | Sum of `gold_gained` across all rooms.                                       |
| `gold_spent`      | int  | Sum of `gold_spent`.                                                         |
| `gold_lost`       | int  | Sum of `gold_lost` (events / curses).                                        |
| `cards_added`     | int  | Total number of cards added to the deck.                                     |
| `cards_removed`   | int  | Total number of cards removed.                                               |
| `cards_upgraded`  | int  | Total number of upgrade events at rest sites.                                |
| `potions_used`    | int  | Total potions consumed in combat.                                            |
| `elites_visited`  | int  | Number of elite rooms visited (run-wide; same for every player).             |
| `bosses_visited`  | int  | Number of boss rooms visited.                                                |
| `hp_end`          | int  | Final `current_hp` recorded for this player.                                 |
| `max_hp_end`      | int  | Final `max_hp` recorded.                                                     |
| `gold_end`        | int  | Final `current_gold` recorded.                                               |

---

## `nodes`

One entry per visited map node, in chronological order across all acts.

### Node-level fields

| Field        | Type     | Always present | Description                                                                                |
| ------------ | -------- | -------------- | ------------------------------------------------------------------------------------------ |
| `act`        | int      | yes            | 1-based act number (1 corresponds to `meta.acts[0]`).                                      |
| `type`       | string   | yes            | `map_point_type`: `ancient`, `monster`, `elite`, `boss`, `rest_site`, `shop`, `treasure`, `unknown`, `event`. |
| `room_type`  | string   | when different | Underlying `room_type`. Only emitted when it differs from `type` (e.g. `type:"unknown"` + `room_type:"event"`). |
| `encounter`  | string   | combat nodes   | Encounter id, for `monster` / `elite` / `boss` rooms.                                      |
| `event`      | string   | event rooms    | Event model id (e.g. `"NEOW"`).                                                            |
| `model`      | string   | other          | Room `model_id` for non-combat / non-event rooms when present.                             |
| `monsters`   | string[] | combat nodes   | List of monster ids in the encounter.                                                      |
| `turns`      | int      | combat nodes   | Turns the encounter lasted. Omitted when zero.                                             |
| `players`    | object[] | when non-empty | Per-player entries for this node (see below). Players with no changes are omitted entirely. |

### `nodes[].players[]` — per-player entry

Every field other than `index` is **only emitted when meaningful**, so a player
who just walked through a room without any state change won't appear at all.
`hp` and `gold` are emitted only when their values changed since the previous
node (per-player tracking), so unchanged values are not repeated.

#### Resource changes

| Field          | Type | Notes                                                  |
| -------------- | ---- | ------------------------------------------------------ |
| `index`        | int  | Player index — links back to `players[].index`.        |
| `hp`           | int  | New `current_hp` (only if changed since last node).    |
| `gold`         | int  | New `current_gold` (only if changed since last node).  |
| `damage_taken` | int  | HP lost in this room.                                  |
| `healed`       | int  | HP healed in this room.                                |
| `max_hp_gained`| int  | Max HP gained.                                         |
| `max_hp_lost`  | int  | Max HP lost.                                           |
| `gold_lost`    | int  | Gold lost (curses, events).                            |
| `gold_stolen`  | int  | Gold stolen from the player.                           |

#### Card decisions

| Field              | Type                       | Notes                                                                       |
| ------------------ | -------------------------- | --------------------------------------------------------------------------- |
| `card_picked`      | string                     | The card chosen from a card reward.                                         |
| `cards_skipped`    | string[]                   | Cards offered but not picked.                                               |
| `cards_gained`     | string[]                   | Cards added outside the standard pick (events, shop buys, transforms). The `card_picked` value is filtered out so it isn't double-counted. |
| `cards_removed`    | string[]                   | Cards removed from the deck.                                                |
| `cards_upgraded`   | string[]                   | Cards upgraded (typically at rest sites).                                   |
| `cards_downgraded` | string[]                   | Cards downgraded.                                                           |
| `cards_transformed`| `[{from,to}]`              | Card transformations.                                                       |
| `cards_enchanted`  | `[{card,enchantment}]`     | Enchantments applied.                                                       |

#### Relics & potions

| Field              | Type     | Notes                                                                |
| ------------------ | -------- | -------------------------------------------------------------------- |
| `relic_picked`     | string   | Picked relic from a relic reward.                                    |
| `relics_skipped`   | string[] | Relics offered but not picked.                                       |
| `relics_bought`    | string[] | Relics purchased at a shop.                                          |
| `relics_lost`      | string[] | Relics removed from inventory.                                       |
| `potions_picked`   | string[] | Potions picked up after combat.                                      |
| `potions_skipped`  | string[] | Potions offered but not picked.                                      |
| `potions_bought`   | string[] | Potions purchased.                                                   |
| `potions_used`     | string[] | Potions consumed in this room.                                       |
| `potions_discarded`| string[] | Potions discarded.                                                   |
| `colorless_bought` | string[] | Colorless cards bought.                                              |

#### Rooms / events / Neow

| Field              | Type                  | Notes                                                                            |
| ------------------ | --------------------- | -------------------------------------------------------------------------------- |
| `rest_choice`      | string \| string[]    | Rest-site choice (`"SMITH"`, `"REST"`, …). Scalar when single, array if multiple. |
| `event_choice`     | string \| string[]    | Event-choice title key(s) selected.                                               |
| `neow_choice`      | string                | Neow / ancient-room option chosen (raw `TextKey`, no prefix to strip).            |
| `neow_skipped`     | string[]              | Neow options offered but not chosen.                                              |
| `quests_completed` | array                 | Completed quest entries (passed through verbatim).                                |

---

## Conventions & quirks

- **Prefix stripping.** The parser strips the leading namespace from any id
  string it recognises. Strings without a known prefix (e.g. Neow `TextKey`
  values, rest-site choice strings) are passed through verbatim.
- **Card upgrades.** Encoded inline in `players[].deck` as `+N`, e.g.
  `"FOOTWORK+1"`. `cards_upgraded` lists in node entries refer to base ids
  without the suffix because the suffix is implied (an upgrade event always
  means `+1` relative to the previous level).
- **Player presence.** A `nodes[].players` entry will only be present for
  players who actually had something to record at that node. Walking through a
  room with no change emits nothing.
- **Aggregate elites/bosses.** `players[].totals.elites_visited` and
  `bosses_visited` are counted per node visited and are therefore identical
  across players in a co-op run — they're duplicated for convenience.

---

## Example (abridged)

```json
{
  "meta": {
    "seed": "CTP924ZB48",
    "start_time": 1773781559,
    "duration": 4160,
    "ascension": 0,
    "acts": ["OVERGROWTH", "HIVE", "GLORY"],
    "win": false,
    "killed_by": "QUEEN_BOSS",
    "killed_at": { "act": 3, "node": 14, "type": "boss", "id": "QUEEN_BOSS" },
    "player_count": 1
  },
  "players": [
    {
      "index": 0,
      "player_id": 76561198012293729,
      "character": "SILENT",
      "deck": ["STRIKE_SILENT", "DEFEND_SILENT", "NOXIOUS_FUMES+1", "..."],
      "relics": ["RING_OF_THE_SNAKE", "NEOWS_TORMENT", "..."],
      "potions": ["DUPLICATOR"],
      "max_potions": 3,
      "totals": {
        "damage_taken": 142, "healed": 30,
        "gold_earned": 410, "gold_spent": 250, "gold_lost": 0,
        "cards_added": 18, "cards_removed": 2, "cards_upgraded": 4,
        "potions_used": 5, "elites_visited": 4, "bosses_visited": 3,
        "hp_end": 0, "max_hp_end": 70, "gold_end": 160
      }
    }
  ],
  "nodes": [
    {
      "act": 1,
      "type": "monster",
      "encounter": "SEAPUNK_WEAK",
      "monsters": ["SEAPUNK"],
      "turns": 4,
      "players": [
        {
          "index": 0,
          "hp": 62,
          "gold": 117,
          "damage_taken": 8,
          "card_picked": "POISONED_STAB",
          "cards_skipped": ["LEADING_STRIKE", "CLOAK_AND_DAGGER"]
        }
      ]
    }
  ]
}
```

---

## Common analytics queries

A few examples of how to use the schema:

- **Most lethal encounters** — group losing runs by `meta.killed_by` (or by
  `meta.killed_at.id`).
- **Card win-rate** — for each card id, count `players[].deck` membership
  partitioned on `meta.win`.
- **HP-preservation cards** — for runs that contain a card, average
  `players[].totals.damage_taken` (lower is better) and
  `hp_end / max_hp_end`.
- **Pick vs. skip rate per card** — across all `nodes[].players[].card_picked`
  and `nodes[].players[].cards_skipped` entries, count appearances of each card
  id and divide.
- **Pick impact on next-fight HP** — pair a `card_picked` with the
  `damage_taken` value on the same player's next combat node.
