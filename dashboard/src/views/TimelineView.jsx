import { useState, useMemo } from 'react';
import { useRunData } from '../data/RunDataContext.jsx';
import './TimelineView.css';

const NODE_META = {
  ancient:   { glyph: '✦', color: 'var(--brass-300)',   label: 'Ancient' },
  boss:      { glyph: '☠', color: 'var(--status-loss)',  label: 'Boss' },
  elite:     { glyph: '⚔', color: '#7a3f1a',             label: 'Elite' },
  monster:   { glyph: '⚔', color: 'var(--brass-500)',    label: 'Fight' },
  rest_site: { glyph: '⌂', color: 'var(--status-win)',   label: 'Rest' },
  shop:      { glyph: '⚖', color: 'var(--brass-700)',    label: 'Shop' },
  treasure:  { glyph: '❖', color: 'var(--brass-300)',    label: 'Treasure' },
  unknown:   { glyph: '?', color: 'var(--ink-400)',       label: 'Event' },
};

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function NodeEvents({ node, playerIndex, resolver }) {
  const p = (node.players ?? []).find((pl) => pl.index === playerIndex) ?? node.players?.[0];
  if (!p) return null;

  const events = [];

  if (p.card_picked) events.push({ key: 'card', icon: '🃏', text: `Picked ${resolver.card(p.card_picked)}` });
  // Skip relic_picked when it's already shown via neow_choice (same item, different field)
  if (p.relic_picked && p.relic_picked !== p.neow_choice) events.push({ key: 'relic', icon: '🔮', text: `Relic: ${resolver.name('relic', p.relic_picked)}` });
  if (p.neow_choice) events.push({ key: 'neow', icon: '✨', text: `Neow: ${resolver.name('neow', p.neow_choice)}` });
  if (p.rest_choice) {
    const rc = Array.isArray(p.rest_choice) ? p.rest_choice[0] : p.rest_choice;
    events.push({ key: 'rest', icon: '🔥', text: resolver.name('rest_choice', rc) });
  }
  if (p.healed > 0) events.push({ key: 'heal', icon: '💚', text: `+${p.healed} HP` });
  if ((p.damage_taken ?? 0) > 0) events.push({ key: 'dmg', icon: '💔', text: `-${p.damage_taken} HP` });
  if ((p.cards_upgraded ?? []).length > 0) {
    events.push({ key: 'upgrade', icon: '⬆', text: `Upgraded ${resolver.cards(p.cards_upgraded).join(', ')}` });
  }
  if ((p.relics_bought ?? []).length > 0) {
    events.push({ key: 'shop_r', icon: '🛒', text: resolver.names('relic', p.relics_bought).join(', ') });
  }
  if ((p.colorless_bought ?? []).length > 0) {
    events.push({ key: 'shop_c', icon: '🛒', text: resolver.cards(p.colorless_bought).join(', ') });
  }
  if (p.event_choice && !p.neow_choice) {
    // Skip junk suffixes like "RELIC_ID.title"
    const raw = String(p.event_choice);
    const label = raw.split('.').pop().replace(/_/g, ' ');
    if (label.toLowerCase() !== 'title' && label.toLowerCase() !== 'description') {
      events.push({ key: 'event', icon: '📜', text: label });
    }
  }

  return (
    <>
      {events.map((e) => (
        <div key={e.key} className="timeline-node__event">
          <span className="timeline-node__event-icon">{e.icon}</span>
          <span>{e.text}</span>
        </div>
      ))}
    </>
  );
}

function TimelineNode({ node, playerIndex, isKilledHere, resolver }) {
  const meta = NODE_META[node.type] ?? NODE_META.unknown;
  const p = (node.players ?? []).find((pl) => pl.index === playerIndex) ?? node.players?.[0];

  const title =
    node.type === 'boss' || node.type === 'elite' || node.type === 'monster'
      ? resolver.name('encounter', node.encounter)
      : node.type === 'unknown'
      ? resolver.name('event', node.event)
      : meta.label;

  return (
    <div className={`timeline-node${isKilledHere ? ' timeline-node--death' : ''}`}>
      <div className="timeline-node__spine">
        <div className="timeline-node__dot" style={{ borderColor: meta.color, color: meta.color }}>
          {meta.glyph}
        </div>
        <div className="timeline-node__line" />
      </div>
      <div className="timeline-node__body">
        <div className="timeline-node__header">
          <span className="timeline-node__act">A{node.act}</span>
          <span className="timeline-node__type" style={{ color: meta.color }}>{meta.label}</span>
          <span className="timeline-node__title">{title}</span>
          {isKilledHere && <span className="tag tag--loss" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>☠ Death</span>}
        </div>
        <div className="timeline-node__stats">
          {p?.hp != null && <span>❤ {p.hp}</span>}
          {p?.gold != null && <span>🪙 {p.gold}</span>}
          {node.turns != null && <span>{node.turns}t</span>}
        </div>
        <NodeEvents node={node} playerIndex={playerIndex} resolver={resolver} />
      </div>
    </div>
  );
}

function RunSelector({ runs, selectedId, onSelect, resolver }) {
  return (
    <div className="timeline-selector">
      {runs.map((run) => {
        const char = resolver.name('character', run.players?.[0]?.character);
        const win = run.meta?.win;
        const date = run.meta?.start_time
          ? new Date(run.meta.start_time * 1000).toLocaleDateString()
          : '—';
        const active = run.__run_id === selectedId;
        return (
          <button
            key={run.__run_id}
            className={`timeline-selector__btn${active ? ' is-active' : ''}`}
            onClick={() => onSelect(run.__run_id)}
          >
            <span className={`tag ${win ? 'tag--win' : 'tag--loss'}`} style={{ fontSize: '0.7rem' }}>
              {win ? 'W' : 'L'}
            </span>
            <span>{char}</span>
            <span style={{ color: 'var(--ink-500)', fontSize: '0.8rem' }}>A{run.meta?.ascension ?? 0}</span>
            <span style={{ color: 'var(--ink-500)', fontSize: '0.8rem' }}>{date}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TimelineView() {
  const { pocRuns, resolver } = useRunData();

  // Sort runs latest-first
  const sortedRuns = useMemo(
    () => [...pocRuns].sort((a, b) => (b.meta?.start_time ?? 0) - (a.meta?.start_time ?? 0)),
    [pocRuns],
  );

  const [selectedId, setSelectedId] = useState(() => sortedRuns[0]?.__run_id ?? null);
  const [playerIndex, setPlayerIndex] = useState(0);

  const run = useMemo(
    () => sortedRuns.find((r) => r.__run_id === selectedId) ?? sortedRuns[0] ?? null,
    [sortedRuns, selectedId],
  );

  const killedByEnc = run?.meta?.killed_by ?? null;

  if (pocRuns.length === 0) return <div className="state">No runs available.</div>;

  return (
    <div className="grid" style={{ gap: 'var(--pad-lg)' }}>
      <h2>Timeline</h2>

      <RunSelector runs={sortedRuns} selectedId={run?.__run_id} onSelect={setSelectedId} resolver={resolver} />

      {run && (
        <>
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{resolver.name('character', run.players?.[0]?.character)}</strong>
              {' · A'}{run.meta?.ascension ?? 0}
              {' · '}
              <span className={`tag ${run.meta?.win ? 'tag--win' : 'tag--loss'}`}>
                {run.meta?.win ? 'Victory' : 'Defeat'}
              </span>
              {run.meta?.duration ? ` · ${formatDuration(run.meta.duration)}` : ''}
            </div>
            {run.players?.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {run.players.map((pl) => (
                  <button
                    key={pl.index}
                    className={`filter-bar__pill${pl.index === playerIndex ? ' is-active' : ''}`}
                    onClick={() => setPlayerIndex(pl.index)}
                  >
                    {resolver.name('character', pl.character)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="timeline">
            {(run.nodes ?? []).map((node, i) => (
              <TimelineNode
                key={i}
                node={node}
                playerIndex={playerIndex}
                isKilledHere={!run.meta?.win && node.encounter != null && node.encounter === killedByEnc}
                resolver={resolver}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
