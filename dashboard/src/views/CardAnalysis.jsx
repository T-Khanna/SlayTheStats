import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useRunData } from '../data/RunDataContext.jsx';
import { useFilters } from '../data/useFilters.js';
import FilterBar from '../components/FilterBar.jsx';

const FIGHT_TYPES = new Set(['monster', 'elite', 'boss']);
const MIN_RUNS_FOR_CHART = 3; // minimum deck appearances to show in top-N chart

// Starter cards that appear in every run by default — excluded from analysis
function isStarterCard(id) {
  const base = id.replace(/\+\d+$/, '');
  return base.startsWith('STRIKE_') || base.startsWith('DEFEND_');
}

// Signal weights (must sum to 1)
const WEIGHTS = {
  winRateLift:    0.35,
  pickRateInWins: 0.35,
  damageReduction: 0.15,
  turnReduction:   0.15,
};

const SIGNAL_LABELS = {
  winRateLift:     'Win-rate lift',
  pickRateInWins:  'Pick rate (wins)',
  damageReduction: 'Damage reduction',
  turnReduction:   'Turn efficiency',
};

// ─── Scoring ────────────────────────────────────────────────────────────────

function buildCardStats(runs, resolver) {
  if (runs.length === 0) return [];

  const totalRuns = runs.length;
  const overallWinRate = runs.filter((r) => r.meta?.win).length / totalRuns;

  // Global averages for normalising damage/turn signals
  let globalDamageSum = 0;
  let globalTurnsSum = 0;
  let globalCombatRuns = 0;

  for (const run of runs) {
    const player = run.players?.[0];
    if (!player) continue;
    globalDamageSum += player.totals?.damage_taken ?? 0;
    const combatNodes = (run.nodes ?? []).filter((n) => FIGHT_TYPES.has(n.type));
    if (combatNodes.length > 0) {
      globalTurnsSum +=
        combatNodes.reduce((s, n) => s + (n.turns ?? 0), 0) / combatNodes.length;
      globalCombatRuns++;
    }
  }

  const avgGlobalDamage = totalRuns > 0 ? globalDamageSum / totalRuns : 0;
  const avgGlobalTurns = globalCombatRuns > 0 ? globalTurnsSum / globalCombatRuns : 0;

  // Per-card accumulators
  const cardMap = new Map();

  function getCard(id) {
    if (!cardMap.has(id)) {
      cardMap.set(id, {
        id,
        // deck-based (win-rate / damage / turn)
        runsWithCard: 0,
        winsWithCard: 0,
        totalDamage: 0,
        totalTurnsPerCombat: 0,
        // offer-based (pick rate)
        timesOffered: 0,
        timesOfferedInWins: 0,
        timesPicked: 0,
        timesPickedInWins: 0,
      });
    }
    return cardMap.get(id);
  }

  for (const run of runs) {
    const isWin = run.meta?.win ?? false;
    const player = run.players?.[0];
    if (!player) continue;

    const deckSet = new Set(player.deck ?? []);
    const damage = player.totals?.damage_taken ?? 0;
    const combatNodes = (run.nodes ?? []).filter((n) => FIGHT_TYPES.has(n.type));
    const turnsPerCombat =
      combatNodes.length > 0
        ? combatNodes.reduce((s, n) => s + (n.turns ?? 0), 0) / combatNodes.length
        : 0;

    // Deck-membership signals
    for (const cardId of deckSet) {
      if (isStarterCard(cardId)) continue;
      const c = getCard(cardId);
      c.runsWithCard++;
      if (isWin) c.winsWithCard++;
      c.totalDamage += damage;
      c.totalTurnsPerCombat += turnsPerCombat;
    }

    // Offer/pick signals (card reward nodes only)
    for (const node of run.nodes ?? []) {
      for (const p of node.players ?? []) {
        if (p.index !== 0) continue;
        const picked = p.card_picked;
        const skipped = p.cards_skipped ?? [];
        const offered = [...(picked ? [picked] : []), ...skipped];

        for (const cardId of offered) {
          if (isStarterCard(cardId)) continue;
          const c = getCard(cardId);
          c.timesOffered++;
          if (isWin) c.timesOfferedInWins++;
        }
        if (picked && !isStarterCard(picked)) {
          const c = getCard(picked);
          c.timesPicked++;
          if (isWin) c.timesPickedInWins++;
        }
      }
    }
  }

  // Compute raw signal values
  const rows = [];

  for (const [id, c] of cardMap) {
    const winRateWithCard = c.runsWithCard > 0 ? c.winsWithCard / c.runsWithCard : 0;
    const winRateLift = winRateWithCard - overallWinRate;

    const avgDamage = c.runsWithCard > 0 ? c.totalDamage / c.runsWithCard : avgGlobalDamage;
    const damageReduction =
      avgGlobalDamage > 0 ? (avgGlobalDamage - avgDamage) / avgGlobalDamage : 0;

    const avgTurns =
      c.runsWithCard > 0 ? c.totalTurnsPerCombat / c.runsWithCard : avgGlobalTurns;
    const turnReduction =
      avgGlobalTurns > 0 ? (avgGlobalTurns - avgTurns) / avgGlobalTurns : 0;

    const pickRateInWins =
      c.timesOfferedInWins > 0 ? c.timesPickedInWins / c.timesOfferedInWins : 0;

    rows.push({
      id,
      name: resolver.card(id),
      runsWithCard: c.runsWithCard,
      winRate: Math.round(winRateWithCard * 100),
      avgDamage: Math.round(avgDamage),
      avgTurns: +avgTurns.toFixed(1),
      pickRateInWins: Math.round(pickRateInWins * 100),
      timesOffered: c.timesOffered,
      timesPicked: c.timesPicked,
      _signals: { winRateLift, pickRateInWins, damageReduction, turnReduction },
    });
  }

  // Min-max normalise each signal, then compute weighted composite score
  const fields = Object.keys(WEIGHTS);
  const bounds = {};
  for (const f of fields) {
    const vals = rows.map((r) => r._signals[f]);
    bounds[f] = { min: Math.min(...vals), max: Math.max(...vals) };
  }

  for (const row of rows) {
    let score = 0;
    const norm = {};
    for (const f of fields) {
      const { min, max } = bounds[f];
      const n = max > min ? (row._signals[f] - min) / (max - min) : 0.5;
      norm[f] = Math.round(n * 100);
      score += n * WEIGHTS[f];
    }
    row.score = Math.round(score * 100);
    row._norm = norm;
  }

  rows.sort((a, b) => b.score - a.score);
  return rows;
}

// ─── Chart tooltip ──────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: 'var(--parchment-100)',
  border: '1px solid var(--brass-500)',
  borderRadius: 8,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
};

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '8px 12px', minWidth: 210 }}>
      <strong>{d.name}</strong>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
        {Object.entries(d._norm).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
            <span style={{ color: 'var(--ink-500)' }}>{SIGNAL_LABELS[k]}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        ))}
        <div
          style={{
            borderTop: '1px solid var(--brass-300)',
            marginTop: 4,
            paddingTop: 4,
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 600,
          }}
        >
          <span>Composite</span>
          <span>{d.score}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Table columns ───────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: 'name',           label: 'Card',          align: 'left'  },
  { key: 'runsWithCard',   label: 'Runs',          align: 'right' },
  { key: 'winRate',        label: 'Win%',          align: 'right' },
  { key: 'pickRateInWins', label: 'Pick% (wins)',  align: 'right' },
  { key: 'avgDamage',      label: 'Avg DMG',       align: 'right' },
  { key: 'avgTurns',       label: 'Avg Turns',     align: 'right' },
  { key: 'score',          label: 'Impact Score',  align: 'right' },
];

// ─── View ────────────────────────────────────────────────────────────────────

export default function CardAnalysis() {
  const { resolver } = useRunData();
  const { filters, setFilter, filteredRuns } = useFilters();
  const [sort, setSort] = useState({ col: 'score', dir: 'desc' });
  const [hoveredId, setHoveredId] = useState(null);

  const allRows = useMemo(
    () => buildCardStats(filteredRuns, resolver),
    [filteredRuns, resolver],
  );

  const sortedRows = useMemo(() => {
    return allRows.slice().sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (typeof av === 'string')
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
  }, [allRows, sort]);

  function toggleSort(col) {
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));
  }

  const topCards = useMemo(
    () => allRows.filter((r) => r.runsWithCard >= MIN_RUNS_FOR_CHART).slice(0, 15),
    [allRows],
  );

  const hoveredEntry = hoveredId ? sortedRows.find((r) => r.id === hoveredId) ?? null : null;

  return (
    <div className="grid" style={{ gap: 'var(--pad-lg)' }}>
      <h2>Card Analysis</h2>
      <FilterBar filters={filters} setFilter={setFilter} runCount={filteredRuns.length} />

      {filteredRuns.length === 0 && (
        <div className="state">No runs match the current filters.</div>
      )}

      {filteredRuns.length > 0 && (
        <>
          {/* ── Top cards bar chart ── */}
          <section className="panel">
            <h3>Top Cards by Impact Score</h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--ink-500)' }}>
              Cards with ≥{MIN_RUNS_FOR_CHART} runs in final deck · Composite: win-rate lift (35%),
              pick rate in wins (35%), damage (15%), turns (15%) · Hover a bar for signal breakdown
            </p>
            {topCards.length === 0 ? (
              <div className="state">Not enough data yet — more runs needed.</div>
            ) : (
              <div style={{ width: '100%', height: Math.max(300, topCards.length * 24 + 50) }}>
                <ResponsiveContainer>
                  <BarChart
                    data={topCards}
                    layout="vertical"
                    margin={{ top: 4, right: 60, bottom: 4, left: 160 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(74,52,26,0.15)" />
                    <XAxis
                      type="number"
                      stroke="var(--ink-700)"
                      fontSize={12}
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--ink-700)"
                      fontSize={11}
                      width={160}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {topCards.map((d, i) => (
                        <Cell
                          key={d.id}
                          fill={i < 3 ? 'var(--brass-500)' : 'var(--brass-300)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ── Full sortable table ── */}
          <section className="panel">
            <h3>All Cards</h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--ink-500)' }}>
              Hover a row for signal breakdown · Click headers to sort
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--brass-500)' }}>
                    {TABLE_COLS.map((col) => {
                      const isActive = sort.col === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => toggleSort(col.key)}
                          style={{
                            padding: '6px 10px',
                            textAlign: col.align,
                            fontFamily: 'var(--font-display)',
                            fontSize: '0.75rem',
                            letterSpacing: '0.08em',
                            color: isActive ? 'var(--brass-700)' : 'var(--ink-500)',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          {col.label}
                          {isActive ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, i) => (
                    <tr
                      key={row.id}
                      onMouseEnter={() => setHoveredId(row.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        background:
                          row.id === hoveredId
                            ? 'rgba(184,131,51,0.12)'
                            : i % 2 === 0
                            ? 'transparent'
                            : 'rgba(74,52,26,0.04)',
                        borderBottom: '1px solid rgba(184,131,51,0.2)',
                        cursor: 'default',
                      }}
                    >
                      <td style={{ padding: '5px 10px' }}>{row.name}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.runsWithCard}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.winRate}%
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.timesOffered > 0 ? `${row.pickRateInWins}%` : '—'}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.avgDamage}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.avgTurns}
                      </td>
                      <td
                        style={{
                          padding: '5px 10px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: row.score >= 70 ? 'var(--brass-700)' : 'inherit',
                        }}
                      >
                        {row.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Hover signal breakdown panel (fixed bottom-right) ── */}
          {hoveredEntry && (
            <div
              style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 100,
                background: 'var(--parchment-100)',
                border: '1px solid var(--brass-500)',
                borderRadius: 10,
                padding: '10px 16px',
                minWidth: 230,
                boxShadow: '0 4px 20px rgba(74,52,26,0.25)',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
              }}
            >
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem' }}>
                {hoveredEntry.name}
              </strong>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(hoveredEntry._norm).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                    <span style={{ color: 'var(--ink-500)' }}>{SIGNAL_LABELS[k]}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  </div>
                ))}
                <div
                  style={{
                    borderTop: '1px solid var(--brass-300)',
                    marginTop: 4,
                    paddingTop: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 600,
                  }}
                >
                  <span>Composite score</span>
                  <span style={{ color: 'var(--brass-700)' }}>{hoveredEntry.score}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)', marginTop: 2 }}>
                  {hoveredEntry.runsWithCard} runs in deck · {hoveredEntry.timesOffered} times offered
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
