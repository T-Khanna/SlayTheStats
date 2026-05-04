# SlayTheStats — Implementation Decisions

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 19 + Vite 8 | Fast HMR, minimal config, familiar ecosystem |
| Router | React Router DOM 7 | State-based navigation across 4+ views |
| Charts | Recharts 3 | React-native, composable |
| Styling | CSS Custom Properties (no framework) | Full theming control; parchment + brass variables in `theme.css` |
| Data | Static local JSON, no backend | All data is local; no network or server needed |

---

## How the Dashboard Runs

**Development:** `npm run dev` inside `dashboard/` starts Vite's dev server (default `http://localhost:5173`). Open in browser — live reload on file changes.

**Production / sharing:** `npm run build` outputs a fully self-contained static bundle to `dashboard/dist/`. The `dist/` folder can be:
- Opened directly by double-clicking `index.html` *(note: browsers block `fetch()` from `file://` — copy the JSON data files alongside it or use the dev server)*
- Served with any static file server: `npx serve dist` or VS Code Live Server extension
- No build step needed day-to-day — `npm run dev` is the normal workflow for local use

---

## Data Pipeline

```
STS2 history folder (*.run)
.../SlayTheSpire2/steam/<account>/profile*/saves/history
        │
  ▼ npm run ingest-latest [-- --count N | -- --all]
        │
out/simplified/*.simplified.json   (ID-only, ~70% size reduction)
        │
        ▼ Vite static import or fetch()
        │
decorateRunWithNames(run, displayNames)   ← frontend/displayNameMapper.js
        │
        ▼
React components
```

- `out/simplified/` is **gitignored** — regenerate locally with the parser
- `data/display_names.json` is committed and loaded as a static asset
- `data/run_history/` is deprecated; use live history ingestion by default

---

## Name Mapping Strategy

Name enrichment is done **client-side only** to keep the simplified JSON output lean. The parser emits raw IDs (e.g. `"NOXIOUS_FUMES+1"`, `"GremlinNob"`); the frontend resolves them using `data/display_names.json` at analysis time.

`data/display_names.json` is the single source of truth (1205 entries across 10 categories: act, card, character, encounter, event, monster, neow, potion, relic, rest_choice).

The translation layer should be implemented however best fits the component structure — the existing `frontend/displayNameMapper.js` is a starting point but can be modified, extended, or replaced. The core requirement is: **any place a raw ID is displayed or used in analysis, resolve it through `display_names.json` dynamically**.

Upgraded card convention: `NOXIOUS_FUMES+1` → `"Noxious Fumes+"` (matches in-game display; `+N` stripped since cards upgrade once)

---

## Card Impact Scoring ✅

**Weighted composite score** combining multiple signals per card across all solo runs.
Starter cards (Strikes, Defends) are excluded — they appear in every run and carry no discriminating signal.

| Signal | Weight | Notes |
|--------|--------|-------|
| Win-rate lift | 35% | Card-in-deck win% minus overall win% |
| Pick rate in wins | 35% | How often the card is chosen when offered, in winning runs |
| Damage reduction | 15% | Runs with card show below-average HP loss |
| Turn efficiency | 15% | Runs with card have shorter average combats |

All signals are min-max normalised to 0–100 before weighting. Cards ranked by composite score descending. Displayed in the **Card Analysis** view with a top-15 bar chart and full sortable table. Hovering a row shows a fixed signal breakdown panel (bottom-right) with each normalised signal value and raw run counts.

---

## Timeline / Run Replay

- Unit: **per node / per floor**
- Source field: `nodes` array in simplified JSON, ordered by floor
- Key events surfaced per node:
  - Card picks (node type `card_reward`)
  - Relic pickups (node type `relic`)
  - Elite fights (`node_type: elite`)
  - Boss fights (`node_type: boss`)
  - Rest choices (`node_type: rest`)
  - Gold delta (show `+N` / `-N` gold at each node)

---

## Data Slice

### Phase 1 (POC) — complete
```js
// Latest 3 single-player runs per character
const pocRuns = allRuns
  .filter(r => r.meta.player_count === 1)
  .sort((a, b) => b.meta.start_time - a.meta.start_time)
  .reduce((acc, run) => {
    const char = run.players[0].character; // e.g. "IRONCLAD", "SILENT", "DEFECT", "REGENT", "NECROBINDER"
    acc[char] = acc[char] ?? [];
    if (acc[char].length < 3) acc[char].push(run);
    return acc;
  }, {});
```

### Phase 2 (Full Build) — complete
Per-character cap removed. All solo runs (`player_count === 1`) are included. `pocSlice.js` updated accordingly.

---

## File / Folder Layout (planned)

```
dashboard/
├── public/
│   └── data/               ← gitignored; populated by prepare-data.mjs
├── scripts/
│   └── prepare-data.mjs   ← copies simplified JSON + display_names into public/data/
├── src/
│   ├── components/
│   │   ├── FilterBar.jsx / .css
│   │   ├── KpiCard.jsx / .css
│   │   └── Layout.jsx / .css
│   ├── data/
│   │   ├── nameResolver.js    ← resolves raw IDs via display_names.json
│   │   ├── runLoader.js       ← fetch manifest + all runs + display_names
│   │   ├── pocSlice.js        ← filter to solo runs (all solo runs, no cap)
│   │   ├── RunDataContext.jsx ← global context: allRuns, pocRuns, resolver
│   │   └── useFilters.js      ← shared filter state + filteredRuns derivation
│   ├── theme/
│   │   └── theme.css          ← CSS custom properties: parchment + brass palette
│   ├── views/
│   │   ├── Overview.jsx
│   │   ├── Runs.jsx
│   │   ├── RunDetail.jsx
│   │   ├── EncounterAnalysis.jsx
│   │   ├── TimelineView.jsx / .css
│   │   └── CardAnalysis.jsx   ← card impact scoring (phase 2)
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
└── package.json
```

---

## Scaffold Command

```bash
npm create vite@latest dashboard -- --template react
cd dashboard
npm install
npm install recharts
```

---

## Out of Scope

- No persistence (filters reset on reload)
- No card/relic image assets (text-only for now)
- Multi-player co-op run support (filtered out by `player_count === 1`)
