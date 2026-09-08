import { NavLink, Outlet } from 'react-router-dom'
import { seasonIndex } from './data/loadSeason'
import { formatDate } from './lib/format'
import TeamSelector from './components/TeamSelector'

export default function App() {
  return (
    <div className="shell">
      <header className="site-header">
        <div className="brand">
          <h1>
            <NavLink to="/">{seasonIndex.leagueName}</NavLink>
          </h1>
          <span className="tagline">ESPN Fantasy Baseball · since {Math.min(...seasonIndex.seasons.map((s) => s.seasonId))}</span>
        </div>
        <nav>
          <NavLink to="/" end>
            Standings
          </NavLink>
          <NavLink to="/matchups">Matchups</NavLink>
          <NavLink to="/stats">Stats</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/h2h">Head-to-Head</NavLink>
          <NavLink to="/teams">Teams</NavLink>
          <NavLink to="/players">Players</NavLink>
        </nav>
        <TeamSelector />
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        Reference only — manage your team on ESPN. Data via the ESPN Fantasy API, refreshed {formatDate(seasonIndex.lastUpdated)}.
      </footer>
    </div>
  )
}
