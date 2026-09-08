import { Link } from 'react-router-dom'
import { leagueSummary } from '../data/loadSeason'
import { useMyTeam, mineClass } from '../data/myTeam'
import { pct, pctString } from '../lib/format'

export default function Teams() {
  const { franchiseId: mine } = useMyTeam()
  const franchises = [...leagueSummary.franchises].sort((a, b) => a.managerName.localeCompare(b.managerName))
  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Franchises</h2>
          <p className="muted">{franchises.length} team slots · a franchise keeps its history when the manager changes</p>
        </div>
      </div>
      <div className="cards">
        {franchises.map((f) => {
          const done = f.seasons.filter((s) => s.isComplete)
          const w = f.seasons.reduce((a, s) => a + s.record.wins, 0)
          const l = f.seasons.reduce((a, s) => a + s.record.losses, 0)
          const t = f.seasons.reduce((a, s) => a + s.record.ties, 0)
          const titles = done.filter((s) => s.champion).length
          const managers = [...new Set(f.seasons.map((s) => s.managerShort))]
          return (
            <Link key={f.id} to={`/team/${f.id}`} className={mineClass(mine, f.id, 'card')}>
              <h4>{f.managerName}</h4>
              <div className="muted">{f.teamName}</div>
              <div className="stats">
                <span>
                  <b>{pctString(pct(w, l, t))}</b> <small className="muted">all-time</small>
                </span>
                <span>
                  <b>{done.filter((s) => s.madePlayoffs).length}</b> <small className="muted">playoffs</small>
                </span>
                <span>
                  <b>{titles ? '🏆'.repeat(titles) : '—'}</b>
                </span>
              </div>
              <small className="muted">
                {f.seasons[0].seasonId}–{f.seasons[f.seasons.length - 1].seasonId}
                {managers.length > 1 ? ` · managers: ${managers.join(', ')}` : ''}
              </small>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
