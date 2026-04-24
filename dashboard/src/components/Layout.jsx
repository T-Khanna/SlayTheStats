import { NavLink, Outlet } from 'react-router-dom';
import { useRunData } from '../data/RunDataContext.jsx';
import './Layout.css';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/runs', label: 'Runs' },
  { to: '/encounters', label: 'Encounters' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/cards', label: 'Cards' },
];

export default function Layout() {
  const { status, error, pocRuns, allRuns } = useRunData();

  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__title">
          <h1>SlayTheStats</h1>
          <span className="layout__subtitle">A chronicle of the spire</span>
        </div>
        <nav className="layout__nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `layout__nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="layout__main">
        {status === 'loading' && <div className="state">Unfurling the scrolls…</div>}
        {status === 'error' && (
          <div className="state">
            Failed to load run data: {String(error?.message ?? error)}
          </div>
        )}
        {status === 'ready' && <Outlet />}
      </main>

      <footer className="layout__footer">
        <span>
          {status === 'ready'
            ? `${pocRuns.length} solo runs (${allRuns.length} total)`
            : '\u00a0'}
        </span>
      </footer>
    </div>
  );
}
