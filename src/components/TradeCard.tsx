import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDay, positionName } from '../lib/format'
import { tradeSides } from '../lib/timeline'
import type { PlayerDirectory, SeasonData, SeasonTransactions, Transaction } from '../types/derived'
import ManagerLabel from './ManagerLabel'

interface Props {
  t: Transaction
  season: SeasonData
  tx?: SeasonTransactions
  players?: PlayerDirectory
  /** Player to emphasize (player page). */
  highlightPlayerId?: number
  defaultOpen?: boolean
}

export default function TradeCard({ t, season, tx, players, highlightPlayerId, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const sides = tradeSides(t)
  const name = (id: number) => tx?.players[String(id)]?.name ?? season.players[String(id)]?.name ?? players?.[String(id)]?.name ?? `Player #${id}`
  const pos = (id: number) => {
    const p = tx?.players[String(id)] ?? season.players[String(id)] ?? players?.[String(id)]
    return p ? positionName(p.positionId) : ''
  }
  const teams = [...sides.keys()]
  return (
    <div className={`trade${open ? ' open' : ''}`}>
      <div className="trade-head" onClick={() => setOpen((v) => !v)} role="button">
        <span className="muted">{formatDay(t.date)}</span>
        <span className="who">
          {teams.map((id, i) => {
            const team = season.teams.find((x) => x.id === id)
            return (
              <span key={id}>
                {i > 0 && <span className="muted"> ⇄ </span>}
                {team ? <ManagerLabel franchiseId={team.franchiseId} managerName={team.managerShort} compact /> : `Team ${id}`}
              </span>
            )
          })}
        </span>
        <span className="muted small">{plural(t.items.filter((i) => i.type === 'TRADE').length, 'player')}</span>
        <span className="chev muted">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="trade-body">
          {teams.map((id) => {
            const team = season.teams.find((x) => x.id === id)
            return (
              <div className="trade-side" key={id}>
                <h5>{team ? `${team.managerName} receives` : `Team ${id} receives`}</h5>
                <ul>
                  {(sides.get(id) ?? []).map((pid) => (
                    <li key={pid} className={pid === highlightPlayerId ? 'hl' : undefined}>
                      <Link to={`/player/${pid}`}>{name(pid)}</Link> <small className="muted">{pos(pid)}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
