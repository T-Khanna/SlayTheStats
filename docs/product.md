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

### 1. Overview ✅
- High-level KPI cards (win rate, total runs, avg gold, avg damage, characters played)
- Win rate by character bar chart
- Deadliest encounters horizontal bar chart
- Shared filter bar (character, outcome, ascension)

### 2. Run Detail ✅
- Inspect a single run: character, ascension level, outcome, duration
- Final deck (resolved display names), relics list, run totals

### 3. Encounter Analysis ✅
- Per-encounter stats: seen count, wins, deaths, win%, avg damage, avg turns
- Most encountered chart (colour-coded by type: monster / elite / boss)
- Deadliest and most damaging horizontal bar charts
- Sortable full table with type filter (All / Monster / Elite / Boss)

### 4. Timeline (Run Replay) ✅
- Run selector showing all available runs sorted latest-first
- Per-node vertical timeline: type badge, encounter/event name, HP, gold, turns
- Events surfaced per node: card picks, relic pickups, Neow choice, rest choices, upgrades, shop buys, damage/healing

### 5. Card Analysis ✅
- Composite impact score per card across all solo runs
- Starter cards (Strikes, Defends) excluded — present in every run, no signal value
- Hover signal panel shows individual normalised signal weights: win-rate lift, pick rate in wins, damage reduction, turn efficiency
- Sortable table + top-15 bar chart
- Filtered by character, outcome, ascension

---

## Filters

- Character (Ironclad, Silent, Defect, Regent, Necrobinder)
- Outcome (win / loss)
- Ascension level (min slider)

---

## Visual Style

**Theme:** Ancient parchment + brass — immersive, in-game aesthetic.

- Parchment-toned backgrounds (warm off-white / tan)
- Brass/gold accent colors for borders, highlights, and headings
- Dark ink text
- Card and relic renders styled to feel like in-game tooltips

---

## Scope

### Phase 1 — Proof of Concept ✅ complete
Scoped to the **latest 3 single-player runs per character** to keep iteration fast.

### Phase 2 — Full Build ✅ complete
- Expanded data slice to **all solo runs** (`meta.player_count === 1`, no cap per character)
- Added **Card Analysis** view (view 5)
- Multi-player co-op runs remain out of scope for now
