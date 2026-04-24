# SlayTheStats — Product Decisions

## Purpose

Cross-run analytics dashboard for a single power-user (the person running the tool locally). Dual purpose:

1. **Cross-run analytics** — aggregate stats across all available runs to surface patterns (win rate, deadliest encounters, best cards, gold economy)
2. **Run drilldown** — inspect any individual run in detail, including a floor-by-floor timeline replay

---

## Target User

Solo power user running the dashboard locally against their own `.run` files. No auth, no server, no multi-user concerns.

---

## Key Performance Indicators (KPIs)

| KPI | Description |
|-----|-------------|
| Win rate | Overall and per-character |
| Deadliest encounter | Encounters most correlated with run-ending deaths |
| Card impact ranking | Which cards appear in winning runs vs losing runs |
| Gold economy | Gold earned, spent, and efficiency over time |
| Character performance | Win/loss breakdown across all 5 characters |

---

## Views

### 1. Overview
- High-level KPI cards (win rate, total runs, most played character, etc.)
- Aggregate charts: win rate by character, deaths by encounter, card frequency in wins vs losses

### 2. Run Detail
- Inspect a single run: character, ascension level, outcome, score
- Card deck at end, relics acquired, potions used
- Floor-by-floor path through the map

### 3. Encounter Analysis
- Per-encounter stats: encounter count, win rate when encountered, death count
- Compare encounters across acts

### 4. Timeline (Run Replay)
- Per-node, per-floor timeline of a selected run
- Key events surfaced: card picks, relic pickups, elite fights, boss fights, rest choices, gold changes

---

## Filters

- Character (Ironclad, Silent, Defect, Watcher, Necrobinder)
- Act (1, 2, 3, epilogue)
- Outcome (win / loss)
- Date range
- Ascension level range

---

## Visual Style

**Theme:** Ancient parchment + brass — immersive, in-game aesthetic.

- Parchment-toned backgrounds (warm off-white / tan)
- Brass/gold accent colors for borders, highlights, and headings
- Dark ink text
- Card and relic renders styled to feel like in-game tooltips

---

## Scope — Proof of Concept

POC is scoped to the **latest 3 single-player runs per character** to keep iteration fast:

- Filter: `meta.player_count === 1`
- Sort by `meta.timestamp` descending
- Take top 3 per unique character
- Remaining runs ignored until full build phase
