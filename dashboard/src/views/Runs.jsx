import { Link } from 'react-router-dom';
import { useRunData } from '../data/RunDataContext.jsx';
import { useFilters } from '../data/useFilters.js';
import FilterBar from '../components/FilterBar.jsx';

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(epoch) {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
}

export default function Runs() {
  const { resolver } = useRunData();
  const { filters, setFilter, filteredRuns } = useFilters();

  return (
    <div>
      <h2>Runs</h2>
      <FilterBar filters={filters} setFilter={setFilter} runCount={filteredRuns.length} />
      {filteredRuns.length === 0 && <div className="state">No runs match the current filters.</div>}
      <div className="grid grid--cards" style={{ marginTop: 'var(--pad-md)' }}>
        {filteredRuns.map((run) => {
          const player = run.players?.[0];
          const charName = resolver.name('character', player?.character);
          const win = run.meta?.win;
          const killer = resolver.name('encounter', run.meta?.killed_by);
          return (
            <Link
              key={run.__file}
              to={`/runs/${run.__run_id}`}
              className="panel"
              style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--brass-500)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{charName}</h3>
                <span className={`tag ${win ? 'tag--win' : 'tag--loss'}`}>
                  {win ? 'Victory' : 'Defeat'}
                </span>
              </div>
              <div className="divider" />
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 4, columnGap: 8, fontSize: '0.9rem' }}>
                <dt style={{ color: 'var(--ink-500)' }}>Date</dt>
                <dd style={{ margin: 0 }}>{formatDate(run.meta?.start_time)}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Duration</dt>
                <dd style={{ margin: 0 }}>{formatDuration(run.meta?.duration)}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Ascension</dt>
                <dd style={{ margin: 0 }}>A{run.meta?.ascension ?? 0}</dd>
                {!win && killer && (
                  <>
                    <dt style={{ color: 'var(--ink-500)' }}>Felled by</dt>
                    <dd style={{ margin: 0 }}>{killer}</dd>
                  </>
                )}
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
