import { Link, useParams } from 'react-router-dom';
import { useRunData } from '../data/RunDataContext.jsx';

function formatDate(epoch) {
  return epoch ? new Date(epoch * 1000).toLocaleString() : '—';
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function RunDetail() {
  const { runId } = useParams();
  const { allRuns, resolver } = useRunData();

  const run = allRuns.find((r) => r.__run_id === runId);
  if (!run) {
    return (
      <div>
        <p><Link to="/runs">← Back to runs</Link></p>
        <div className="state">Run not found.</div>
      </div>
    );
  }

  const player = run.players?.[0];
  const win = run.meta?.win;
  const charName = resolver.name('character', player?.character);
  const killer = resolver.name('encounter', run.meta?.killed_by);
  const acts = resolver.names('act', run.meta?.acts);

  const deck = resolver.cards(player?.deck ?? []);
  const relics = resolver.names('relic', player?.relics ?? []);

  return (
    <div>
      <p><Link to="/runs">← Back to runs</Link></p>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>
            {charName} <span style={{ color: 'var(--ink-500)', fontSize: '1rem' }}>· A{run.meta?.ascension ?? 0}</span>
          </h2>
          <span className={`tag ${win ? 'tag--win' : 'tag--loss'}`}>
            {win ? 'Victory' : 'Defeat'}
          </span>
        </div>
        <div className="divider" />
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 6 }}>
          <dt style={{ color: 'var(--ink-500)' }}>Date</dt>
          <dd style={{ margin: 0 }}>{formatDate(run.meta?.start_time)}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Duration</dt>
          <dd style={{ margin: 0 }}>{formatDuration(run.meta?.duration)}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Acts traveled</dt>
          <dd style={{ margin: 0 }}>{acts.join(' → ') || '—'}</dd>
          {!win && killer && (
            <>
              <dt style={{ color: 'var(--ink-500)' }}>Felled by</dt>
              <dd style={{ margin: 0 }}>{killer}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="grid grid--cards" style={{ marginTop: 'var(--pad-lg)' }}>
        <section className="panel">
          <h3>Final Deck ({deck.length})</h3>
          <ul style={{ columns: 2, columnGap: 'var(--pad-md)', margin: 0, padding: 0, listStyle: 'none' }}>
            {deck.map((c, i) => (
              <li key={i} style={{ padding: '2px 0' }}>{c}</li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h3>Relics ({relics.length})</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {relics.map((r, i) => (
              <li key={i} style={{ padding: '2px 0' }}>{r}</li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h3>Totals</h3>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontVariantNumeric: 'tabular-nums' }}>
            <dt>Damage taken</dt><dd style={{ margin: 0 }}>{player?.totals?.damage_taken ?? 0}</dd>
            <dt>Healed</dt><dd style={{ margin: 0 }}>{player?.totals?.healed ?? 0}</dd>
            <dt>Gold earned</dt><dd style={{ margin: 0 }}>{player?.totals?.gold_earned ?? 0}</dd>
            <dt>Gold spent</dt><dd style={{ margin: 0 }}>{player?.totals?.gold_spent ?? 0}</dd>
            <dt>Cards added</dt><dd style={{ margin: 0 }}>{player?.totals?.cards_added ?? 0}</dd>
            <dt>Cards upgraded</dt><dd style={{ margin: 0 }}>{player?.totals?.cards_upgraded ?? 0}</dd>
            <dt>Elites visited</dt><dd style={{ margin: 0 }}>{player?.totals?.elites_visited ?? 0}</dd>
            <dt>Bosses visited</dt><dd style={{ margin: 0 }}>{player?.totals?.bosses_visited ?? 0}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
