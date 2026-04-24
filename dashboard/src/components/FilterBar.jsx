import { useRunData } from '../data/RunDataContext.jsx';
import './FilterBar.css';

const CHARACTERS = [
  { id: 'IRONCLAD',    label: 'Ironclad' },
  { id: 'SILENT',      label: 'Silent' },
  { id: 'DEFECT',      label: 'Defect' },
  { id: 'REGENT',      label: 'Regent' },
  { id: 'NECROBINDER', label: 'Necrobinder' },
];

const OUTCOMES = [
  { value: 'all',  label: 'All' },
  { value: 'win',  label: 'Wins' },
  { value: 'loss', label: 'Defeats' },
];

export default function FilterBar({ filters, setFilter, runCount }) {
  const { pocRuns } = useRunData();

  const maxAsc = pocRuns.reduce((m, r) => Math.max(m, r.meta?.ascension ?? 0), 0);

  function toggleChar(id) {
    const next = filters.characters.includes(id)
      ? filters.characters.filter((c) => c !== id)
      : [...filters.characters, id];
    setFilter('characters', next);
  }

  return (
    <div className="filter-bar panel">
      <div className="filter-bar__group">
        <span className="filter-bar__label">Character</span>
        <div className="filter-bar__pills">
          {CHARACTERS.map((c) => {
            const active = filters.characters.includes(c.id);
            return (
              <button
                key={c.id}
                className={`filter-bar__pill ${active ? 'is-active' : ''}`}
                onClick={() => toggleChar(c.id)}
                title={active ? 'Remove filter' : 'Filter to this character'}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-bar__group">
        <span className="filter-bar__label">Outcome</span>
        <div className="filter-bar__pills">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              className={`filter-bar__pill ${filters.outcome === o.value ? 'is-active' : ''}`}
              onClick={() => setFilter('outcome', o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {maxAsc > 0 && (
        <div className="filter-bar__group">
          <span className="filter-bar__label">Ascension ≥</span>
          <input
            type="range"
            min={0}
            max={maxAsc}
            value={filters.ascMin}
            onChange={(e) => setFilter('ascMin', Number(e.target.value))}
            className="filter-bar__range"
          />
          <span className="filter-bar__range-val">{filters.ascMin}</span>
        </div>
      )}

      <div className="filter-bar__count">
        {runCount} run{runCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
