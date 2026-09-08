import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '../data/loadSeason'
import { positionName, proTeamName } from '../lib/format'

export default function Players() {
  const { data, loading } = usePlayers()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    const all = Object.values(data).filter((p) => !p.name.startsWith('Player #'))
    const hits = needle ? all.filter((p) => p.name.toLowerCase().includes(needle)) : all
    return hits.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100)
  }, [data, q])

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Players</h2>
          <p className="muted">{data ? Object.keys(data).length : '…'} players have passed through the league. Pick one for their full transaction history.</p>
        </div>
        <input className="search" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {loading && <p className="muted">Loading…</p>}
      <ul className="player-list">
        {list.map((p) => (
          <li key={p.id}>
            <Link to={`/player/${p.id}`}>{p.name}</Link> <small className="muted">
              {positionName(p.positionId)}
              {p.proTeamId ? ` · ${proTeamName(p.proTeamId)}` : ''}
            </small>
          </li>
        ))}
      </ul>
      {data && list.length === 100 && <p className="muted small">Showing the first 100 matches; keep typing to narrow it down.</p>}
    </section>
  )
}
