import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useRunData } from '../data/RunDataContext.jsx';
import { useFilters } from '../data/useFilters.js';
import FilterBar from '../components/FilterBar.jsx';

const FIGHT_TYPES = new Set(['monster', 'elite', 'boss']);

// Strip type suffix added by the game (e.g. " (Weak)", " (Elite)", " (Boss)")
function stripType(name) {
  return name.replace(/ \((Weak|Normal|Elite|Boss|Strong|Potion)\)$/, '');
}

const TYPE_COLORS = {
  monster: 'var(--brass-500)',
  elite: '#7a3f1a',
  boss: 'var(--status-loss)',
};

function buildEncounterStats(runs, resolver) {
  const map = new Map();

  for (const run of runs) {
    const isWin = run.meta?.win ?? false;
    const nodes = run.nodes ?? [];

    for (const node of nodes) {
      if (!FIGHT_TYPES.has(node.type)) continue;
      const enc = node.encounter;
      if (!enc) continue;

      if (!map.has(enc)) {
        map.set(enc, {
          id: enc,
          name: stripType(resolver.name('encounter', enc)),
          type: node.type,
          acts: new Set(),
          count: 0,
          wins: 0,
          deaths: 0,
          totalDamage: 0,
          totalTurns: 0,
        });
      }

      const e = map.get(enc);
      e.count += 1;
      if (node.act) e.acts.add(node.act);
      if (isWin) e.wins += 1;

      const killedBy = run.meta?.killed_by;
      if (!isWin && killedBy === enc) e.deaths += 1;

      for (const p of node.players ?? []) {
        e.totalDamage += p.damage_taken ?? 0;
      }
      e.totalTurns += node.turns ?? 0;
    }
  }

  const rows = Array.from(map.values()).map((e) => ({
    ...e,
    actsLabel: [...e.acts].sort((a, b) => a - b).map((a) => `Act ${a}`).join(', '),
    losses: e.count - e.wins,
    winRate: e.count > 0 ? Math.round((e.wins / e.count) * 100) : 0,
    beatRate: e.count > 0 ? Math.round(((e.count - e.deaths) / e.count) * 100) : 0,
    avgDamage: e.count > 0 ? Math.round(e.totalDamage / e.count) : 0,
    avgTurns: e.count > 0 ? +(e.totalTurns / e.count).toFixed(1) : 0,
  }));

  rows.sort((a, b) => b.count - a.count);
  return rows;
}

const TOOLTIP_STYLE = {
  background: 'var(--parchment-100)',
  border: '1px solid var(--brass-500)',
  borderRadius: 8,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
};

const TABLE_COLS = [
  { key: 'name',      label: 'Encounter',  align: 'left',  title: null },
  { key: 'type',      label: 'Type',       align: 'right', title: null },
  { key: 'actsLabel', label: 'Act',        align: 'right', title: 'Act(s) this encounter appeared in' },
  { key: 'count',     label: 'Seen',       align: 'right', title: 'Total times faced across all filtered runs' },
  { key: 'deaths',    label: 'Kills',      align: 'right', title: 'Times this encounter dealt the killing blow' },
  { key: 'beatRate',  label: 'Beat%',      align: 'right', title: 'How often you survived this specific fight (Seen − Kills) / Seen' },
  { key: 'winRate',   label: 'Run Win%',   align: 'right', title: 'Overall run win rate in runs that included this encounter' },
  { key: 'avgDamage', label: 'Avg DMG',    align: 'right', title: 'Average HP lost in this fight' },
  { key: 'avgTurns',  label: 'Avg Turns',  align: 'right', title: 'Average turns the fight lasted' },
];

export default function EncounterAnalysis() {
  const { resolver } = useRunData();
  const { filters, setFilter, filteredRuns } = useFilters();
  const [sort, setSort] = useState({ col: 'count', dir: 'desc' });
  const [typeFilter, setTypeFilter] = useState('all');

  const baseRows = useMemo(
    () => buildEncounterStats(filteredRuns, resolver),
    [filteredRuns, resolver],
  );

  const rows = useMemo(() => {
    const filtered = typeFilter === 'all' ? baseRows : baseRows.filter((r) => r.type === typeFilter);
    return filtered.slice().sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
  }, [baseRows, sort, typeFilter]);

  function toggleSort(col) {
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));
  }

  const top12ByCount = baseRows.slice(0, 12);
  const topDeadly = baseRows
    .filter((r) => r.deaths > 0)
    .sort((a, b) => b.deaths - a.deaths)
    .slice(0, 10);
  const topDamaging = baseRows
    .slice()
    .sort((a, b) => b.avgDamage - a.avgDamage)
    .slice(0, 10);

  return (
    <div className="grid" style={{ gap: 'var(--pad-lg)' }}>
      <h2>Encounter Analysis</h2>
      <FilterBar filters={filters} setFilter={setFilter} runCount={filteredRuns.length} />

      {filteredRuns.length === 0 && <div className="state">No runs match the current filters.</div>}

      {filteredRuns.length > 0 && (
        <>
          <section className="panel">
            <h3>Most Encountered (top 12)</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={top12ByCount} margin={{ top: 8, right: 16, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(74,52,26,0.15)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--ink-700)"
                    fontSize={11}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis stroke="var(--ink-700)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {top12ByCount.map((d) => (
                      <Cell key={d.id} fill={TYPE_COLORS[d.type] ?? 'var(--brass-500)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', gap: 'var(--pad-md)', fontSize: '0.8rem', color: 'var(--ink-500)' }}>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: color, display: 'inline-block', borderRadius: 2 }} />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
              ))}
            </div>
          </section>

          <div className="grid grid--cards">
            <section className="panel">
              <h3>Deadliest Encounters</h3>
              {topDeadly.length === 0 ? (
                <p className="state">No defeats in filtered runs.</p>
              ) : (
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={topDeadly} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 110 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(74,52,26,0.15)" />
                      <XAxis type="number" stroke="var(--ink-700)" fontSize={12} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="var(--ink-700)" fontSize={11} width={110} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Run-ending deaths']} />
                      <Bar dataKey="deaths" fill="var(--status-loss)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="panel">
              <h3>Most Damaging (avg HP lost)</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={topDamaging} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 110 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(74,52,26,0.15)" />
                    <XAxis type="number" stroke="var(--ink-700)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="var(--ink-700)" fontSize={11} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Avg damage taken']} />
                    <Bar dataKey="avgDamage" fill="var(--brass-700)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="panel">
            <h3>All Encounters</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>Filter:</span>
              {['all', 'monster', 'elite', 'boss'].map((t) => (
                <button
                  key={t}
                  className={`filter-bar__pill${typeFilter === t ? ' is-active' : ''}`}
                  style={{ fontSize: '0.78rem', padding: '2px 10px' }}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--brass-500)' }}>
                    {TABLE_COLS.map((col) => {
                      const isActive = sort.col === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={col.key !== 'type' ? () => toggleSort(col.key) : undefined}
                          title={col.title ?? undefined}
                          style={{
                            padding: '6px 10px',
                            textAlign: col.align,
                            fontFamily: 'var(--font-display)',
                            fontSize: '0.75rem',
                            letterSpacing: '0.08em',
                            color: isActive ? 'var(--brass-700)' : 'var(--ink-500)',
                            whiteSpace: 'nowrap',
                            cursor: col.key !== 'type' ? 'pointer' : 'default',
                            userSelect: 'none',
                          }}
                        >
                          {col.label}{isActive ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(74,52,26,0.04)', borderBottom: '1px solid rgba(184,131,51,0.2)' }}>
                      <td style={{ padding: '5px 10px' }}>{r.name}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                        <span className="tag" style={{ fontSize: '0.75rem' }}>{r.type}</span>
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{r.actsLabel}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.count}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', color: r.deaths > 0 ? 'var(--status-loss)' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>{r.deaths}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.beatRate}%</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.winRate}%</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.avgDamage}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.avgTurns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
