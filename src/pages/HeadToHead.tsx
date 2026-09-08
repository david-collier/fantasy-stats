import { useState } from 'react'
import { Link } from 'react-router-dom'
import { leagueSummary, useAllSeasons } from '../data/loadSeason'
import { useMyTeam } from '../data/myTeam'
import { heat } from '../components/Heatmap'
import { catPct, headToHead, type H2HScope } from '../lib/h2h'

export default function HeadToHead() {
  const [scope, setScope] = useState<H2HScope>('all')
  const [metric, setMetric] = useState<'cats' | 'matchups'>('cats')
  const { data: seasons, loading } = useAllSeasons()
  const { franchiseId: mine } = useMyTeam()
  const franchises = leagueSummary.franchises

  if (loading || !seasons) return <p className="muted">Loading all seasons…</p>
  const matrix = headToHead(seasons, scope)

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Head-to-Head</h2>
          <p className="muted">
            Row vs column, all {seasons.length} seasons. {metric === 'cats' ? 'Category wins-losses-ties' : 'Matchup wins-losses'}; colored by category win rate.
          </p>
        </div>
        <div className="controls">
          <div className="seg">
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
              All
            </button>
            <button className={scope === 'regular' ? 'on' : ''} onClick={() => setScope('regular')}>
              Regular season
            </button>
            <button className={scope === 'playoffs' ? 'on' : ''} onClick={() => setScope('playoffs')}>
              Playoffs only
            </button>
          </div>
          <div className="seg">
            <button className={metric === 'cats' ? 'on' : ''} onClick={() => setMetric('cats')}>
              Categories
            </button>
            <button className={metric === 'matchups' ? 'on' : ''} onClick={() => setMetric('matchups')}>
              Matchups
            </button>
          </div>
        </div>
      </div>

      <div className="heatmap-wrap">
        <table className="heatmap h2h">
          <thead>
            <tr>
              <th></th>
              {franchises.map((f) => (
                <th key={f.id} className={mine === f.id ? 'mine' : undefined}>
                  <Link to={`/team/${f.id}`}>{f.managerShort}</Link>
                </th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {franchises.map((row) => {
              const cells = franchises.map((col) => (row.id === col.id ? null : matrix.get(row.id)?.get(col.id) ?? null))
              const tot = cells.reduce(
                (a, c) => (c ? { cw: a.cw + c.catWins, cl: a.cl + c.catLosses, ct: a.ct + c.catTies, w: a.w + c.wins, l: a.l + c.losses, t: a.t + c.ties } : a),
                { cw: 0, cl: 0, ct: 0, w: 0, l: 0, t: 0 },
              )
              const totPct = catPct({ catWins: tot.cw, catLosses: tot.cl, catTies: tot.ct, wins: 0, losses: 0, ties: 0, games: 0 })
              return (
                <tr key={row.id} className={mine === row.id ? 'mine' : undefined}>
                  <th>
                    <Link to={`/team/${row.id}`}>{row.managerShort}</Link>
                  </th>
                  {cells.map((c, i) =>
                    c === null ? (
                      <td key={i} className="empty" />
                    ) : c.games === 0 ? (
                      <td key={i} className="muted">
                        —
                      </td>
                    ) : (
                      <td key={i} style={{ background: heat(catPct(c)) }} title={`${row.managerShort} vs ${franchises[i].managerShort}: ${c.games} matchups, ${c.wins}-${c.losses}${c.ties ? `-${c.ties}` : ''}; categories ${c.catWins}-${c.catLosses}-${c.catTies}`}>
                        {metric === 'cats' ? `${c.catWins}-${c.catLosses}${c.catTies ? `-${c.catTies}` : ''}` : `${c.wins}-${c.losses}${c.ties ? `-${c.ties}` : ''}`}
                      </td>
                    ),
                  )}
                  <td style={{ background: heat(totPct) }} className="total">
                    {metric === 'cats' ? `${tot.cw}-${tot.cl}-${tot.ct}` : `${tot.w}-${tot.l}${tot.t ? `-${tot.t}` : ''}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">"Playoffs only" counts winners'-bracket games (no consolation). Live weeks are excluded until they finish.</p>
    </section>
  )
}
