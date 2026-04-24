import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useRunData } from '../data/RunDataContext.jsx';
import { useFilters } from '../data/useFilters.js';
import KpiCard from '../components/KpiCard.jsx';
import FilterBar from '../components/FilterBar.jsx';

function summarise(runs, resolver) {
  const total = runs.length;
  const wins = runs.filter((r) => r.meta?.win).length;
  const losses = total - wins;

  const perChar = new Map();
  let totalGold = 0;
  let totalDamage = 0;
  const deathByEncounter = new Map();

  for (const run of runs) {
    const player = run.players?.[0];
    if (!player) continue;
    const char = player.character;
    if (!perChar.has(char)) perChar.set(char, { runs: 0, wins: 0 });
    const bucket = perChar.get(char);
    bucket.runs += 1;
    if (run.meta?.win) bucket.wins += 1;

    totalGold += player.totals?.gold_earned ?? 0;
    totalDamage += player.totals?.damage_taken ?? 0;

    if (!run.meta?.win) {
      const enc = run.meta?.killed_by;
      if (enc) {
        deathByEncounter.set(enc, (deathByEncounter.get(enc) ?? 0) + 1);
      }
    }
  }

  const charData = Array.from(perChar.entries())
    .map(([char, b]) => ({
      character: resolver.name('character', char),
      raw: char,
      runs: b.runs,
      wins: b.wins,
      losses: b.runs - b.wins,
      winRate: b.runs ? Math.round((b.wins / b.runs) * 100) : 0,
    }))
    .sort((a, b) => b.runs - a.runs);

  const topDeaths = Array.from(deathByEncounter.entries())
    .map(([enc, count]) => ({
      encounter: resolver.name('encounter', enc),
      raw: enc,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    total,
    wins,
    losses,
    winRate: total ? Math.round((wins / total) * 100) : 0,
    avgGold: total ? Math.round(totalGold / total) : 0,
    avgDamage: total ? Math.round(totalDamage / total) : 0,
    charData,
    topDeaths,
  };
}

const CHARACTER_COLORS = {
  IRONCLAD: '#8b2f2f',
  SILENT: '#3f6b3a',
  DEFECT: '#3a5a8b',
  WATCHER: '#6b3a8b',
  NECROBINDER: '#5a4a3a',
};

function colorFor(char) {
  return CHARACTER_COLORS[char] ?? 'var(--brass-700)';
}

export default function Overview() {
  const { resolver } = useRunData();
  const { filters, setFilter, filteredRuns } = useFilters();
  const stats = useMemo(() => summarise(filteredRuns, resolver), [filteredRuns, resolver]);

  return (
    <div className="grid" style={{ gap: 'var(--pad-lg)' }}>
      <h2>The Chronicle</h2>
      <FilterBar filters={filters} setFilter={setFilter} runCount={filteredRuns.length} />

      {filteredRuns.length === 0 && (
        <div className="state">No runs match the current filters.</div>
      )}

      {filteredRuns.length > 0 && (
      <>
      <div className="grid grid--kpi">
        <KpiCard label="Runs" value={stats.total} hint="POC slice" />
        <KpiCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          hint={`${stats.wins}W · ${stats.losses}L`}
        />
        <KpiCard label="Avg Gold Earned" value={stats.avgGold} hint="per run" />
        <KpiCard label="Avg Damage Taken" value={stats.avgDamage} hint="per run" />
        <KpiCard label="Characters" value={stats.charData.length} hint="played" />
      </div>

      <div className="grid grid--cards">
        <section className="panel">
          <h3>Win Rate by Character</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={stats.charData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(74,52,26,0.15)" />
                <XAxis dataKey="character" stroke="var(--ink-700)" fontSize={12} />
                <YAxis stroke="var(--ink-700)" fontSize={12} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--parchment-100)',
                    border: '1px solid var(--brass-500)',
                    borderRadius: 8,
                    fontFamily: 'var(--font-body)',
                  }}
                  formatter={(v, _n, p) =>
                    [`${v}% (${p.payload.wins}/${p.payload.runs})`, 'Win rate']
                  }
                />
                <Bar dataKey="winRate" radius={[6, 6, 0, 0]}>
                  {stats.charData.map((d) => (
                    <Cell key={d.raw} fill={colorFor(d.raw)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <h3>Deadliest Encounters</h3>
          {stats.topDeaths.length === 0 ? (
            <p className="state">No defeats recorded.</p>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={stats.topDeaths}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 8, left: 80 }}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(74,52,26,0.15)" />
                  <XAxis type="number" stroke="var(--ink-700)" fontSize={12} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="encounter"
                    stroke="var(--ink-700)"
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--parchment-100)',
                      border: '1px solid var(--brass-500)',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--status-loss)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
      </>
      )}
    </div>
  );
}
