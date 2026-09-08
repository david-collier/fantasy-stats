import { Link } from 'react-router-dom'
import { seasonIndex } from '../data/loadSeason'

export default function History() {
  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Season History</h2>
          <p className="muted">
            {seasonIndex.seasons.filter((s) => s.status === 'ok').length} seasons archived from ESPN.
          </p>
        </div>
      </div>

      <table className="data">
        <thead>
          <tr>
            <th>Season</th>
            <th>Status</th>
            <th>Champion</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {seasonIndex.seasons.map((s) => {
            const ok = s.status === 'ok'
            return (
              <tr key={s.seasonId} className={ok ? undefined : 'muted'}>
                <td>{s.seasonId}</td>
                <td>
                  {ok ? (s.isComplete ? 'Complete' : 'In progress') : statusText(s.status, s.httpStatus)}
                </td>
                <td>{ok ? (s.isComplete ? s.championName ?? '—' : <span className="muted">TBD</span>) : '—'}</td>
                <td className="links">
                  {ok && (
                    <>
                      <Link to={`/standings/${s.seasonId}`}>Standings</Link>
                      <Link to={`/matchups/${s.seasonId}`}>Matchups</Link>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function statusText(status: string, http?: number): string {
  switch (status) {
    case 'unauthorized':
      return `Not visible to this account (HTTP ${http ?? 401})`
    case 'not_found':
      return 'Not found on ESPN'
    default:
      return `Fetch error${http ? ` (HTTP ${http})` : ''}`
  }
}
