# SlayTheStats — Implementation Decisions

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React + Vite | Fast HMR, minimal config, familiar ecosystem |
| Charts | Recharts (primary) + Chart.js (fallback) | Recharts is React-native; Chart.js for edge cases |
| Styling | CSS Modules or Tailwind (TBD at scaffold) | Keep theming isolated per component |
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
data/run_history/*.run
        │
        ▼ parse_run.py --output out/simplified/ data/run_history/
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

---

## Name Mapping Strategy

Name enrichment is done **client-side only** to keep the simplified JSON output lean. The parser emits raw IDs (e.g. `"NOXIOUS_FUMES+1"`, `"GremlinNob"`); the frontend resolves them using `data/display_names.json` at analysis time.

`data/display_names.json` is the single source of truth (1205 entries across 10 categories: act, card, character, encounter, event, monster, neow, potion, relic, rest_choice).

The translation layer should be implemented however best fits the component structure — the existing `frontend/displayNameMapper.js` is a starting point but can be modified, extended, or replaced. The core requirement is: **any place a raw ID is displayed or used in analysis, resolve it through `display_names.json` dynamically**.

Upgraded card convention: `NOXIOUS_FUMES+1` → `"Noxious Fumes+"` (matches in-game display; `+N` stripped since cards upgrade once)

---

## Card Impact Scoring

**Weighted composite score** combining multiple signals:

| Signal | Weight | Notes |
|--------|--------|-------|
| Pick rate in winning runs | High | Cards selected more in wins |
| Win-rate correlation | High | Runs containing this card → win% |
| Damage minimization | Medium | Correlated with lower HP loss |
| Turn minimization | Medium | Correlated with shorter fights |
| Act-bias correction | Applied | Normalize for cards that only appear in act 1 vs act 3 |

Cards ranked by composite score descending. Displayed in the Overview and Encounter Analysis views.

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

## POC Data Slice

```js
// Load all simplified JSONs, filter to single-player runs,
// take latest 3 per character
const pocRuns = allRuns
  .filter(r => r.meta.player_count === 1)
  .sort((a, b) => b.meta.timestamp - a.meta.timestamp)
  .reduce((acc, run) => {
    const char = run.meta.character; // e.g. "IRONCLAD", "SILENT", "DEFECT", "WATCHER", "NECROBINDER"
    acc[char] = acc[char] ?? [];
    if (acc[char].length < 3) acc[char].push(run);
    return acc;
  }, {});
```

---

## File / Folder Layout (planned)

```
dashboard/
├── public/
│   └── data/               ← symlink or copy of out/simplified/ + data/display_names.json
├── src/
│   ├── assets/             ← fonts, textures (parchment, brass)
│   ├── components/
│   │   ├── KpiCard/
│   │   ├── RunCard/
│   │   ├── EncounterTable/
│   │   ├── Timeline/
│   │   └── Charts/
│   ├── hooks/
│   │   └── useRunData.js   ← loads + filters + resolves display names
│   ├── views/
│   │   ├── Overview.jsx
│   │   ├── RunDetail.jsx
│   │   ├── EncounterAnalysis.jsx
│   │   └── TimelineView.jsx
│   ├── nameResolver.js     ← resolves IDs via display_names.json (adapt/replace displayNameMapper.js as needed)
│   ├── theme.css           ← parchment + brass CSS variables
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

## Out of Scope (POC)

- No routing library (single-page with state-based view switching is sufficient for POC)
- No persistence (filters reset on reload)
- No card/relic image assets (text + styled tooltips only for POC)
- No multi-player co-op run support (filtered out by `player_count === 1`)
