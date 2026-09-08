import { Link } from 'react-router-dom'
import { acquisitionLabel, formatDay, isPitcherPosition, positionName, proTeamName, slotName, statValue } from '../lib/format'
import type { PlayerDirectory, RosterEntry, SeasonData } from '../types/derived'

const BENCH = 16
const IL = 17
const HITTER_CATS = new Set([20, 5, 21, 23, 17, 9]) // R HR RBI SB OBP SLG
const PITCHER_CATS = new Set([53, 48, 47, 41, 63, 83]) // W K ERA WHIP QS SVHD
const PITCHER_SLOTS = new Set([13, 14, 15])

interface Props {
  season: SeasonData
  teamId: number
  players?: PlayerDirectory
}

export default function RosterTable({ season, teamId, players }: Props) {
  const roster = season.rosters[String(teamId)] ?? []
  const refFor = (id: number) => season.players[String(id)] ?? players?.[String(id)]
  const isPitcher = (e: RosterEntry) => {
    const p = refFor(e.playerId)
    if (PITCHER_SLOTS.has(e.lineupSlotId)) return true
    if (e.lineupSlotId === BENCH || e.lineupSlotId === IL) return isPitcherPosition(p?.positionId)
    return false
  }
  const hitters = roster.filter((e) => !isPitcher(e))
  const pitchers = roster.filter((e) => isPitcher(e))
  const catsFor = (pitcher: boolean) => season.league.categories.filter((c) => (pitcher ? PITCHER_CATS : HITTER_CATS).has(c.statId))
  const label = season.status.isComplete ? 'End-of-season roster' : 'Current roster'

  const group = (title: string, rows: RosterEntry[], pitcher: boolean) => {
    const cats = catsFor(pitcher)
    const sorted = [...rows].sort((a, b) => slotOrder(a.lineupSlotId) - slotOrder(b.lineupSlotId))
    return (
      <table className="data roster">
        <thead>
          <tr>
            <th>{title}</th>
            <th>Pos</th>
            <th>Acquired</th>
            <th>Keeper</th>
            {cats.map((c) => (
              <th key={c.statId} className="num">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const p = refFor(e.playerId)
            const slot = e.lineupSlotId === BENCH ? 'BN' : e.lineupSlotId === IL ? 'IL' : slotName(e.lineupSlotId)
            return (
              <tr key={e.playerId} className={e.lineupSlotId === IL ? 'muted' : undefined}>
                <td>
                  <span className="slot muted">{slot}</span>
                  <Link to={`/player/${e.playerId}`}>{p?.name ?? `Player #${e.playerId}`}</Link>
                  {p?.proTeamId ? <small className="muted"> {proTeamName(p.proTeamId)}</small> : null}
                </td>
                <td className="muted">{p ? positionName(p.positionId) : ''}</td>
                <td>{acquired(e)}</td>
                <td>{e.keeper ? <span className="badge keeper">since {e.keeperSince ?? '?'}</span> : e.acquisitionType === 'DRAFT' ? <span className="muted">—</span> : ''}</td>
                {cats.map((c) => (
                  <td key={c.statId} className="num">
                    {statValue(c.statId, p?.stats?.[String(c.statId)])}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="roster-wrap">
      <p className="muted small">
        {label} · {roster.length} players · {roster.filter((e) => e.keeper).length} keepers
        {season.league.keeperCount ? ` of ${season.league.keeperCount} allowed` : ''}
      </p>
      {group('Hitters', hitters, false)}
      {group('Pitchers', pitchers, true)}
    </div>
  )
}

function acquired(e: RosterEntry): string {
  if (e.keeper) {
    const origin = e.originType && e.originType !== 'UNKNOWN' ? ` (orig. ${acquisitionLabel(e.originType).toLowerCase()})` : ''
    return `Keeper, R${e.draft?.round ?? '?'}${origin}`
  }
  if (e.acquisitionType === 'DRAFT') return `Draft R${e.draft?.round ?? '?'}${e.draft ? ` #${e.draft.overall}` : ''}`
  return `${acquisitionLabel(e.acquisitionType)} · ${formatDay(e.acquisitionDate)}`
}

function slotOrder(slot: number): number {
  if (slot === BENCH) return 100
  if (slot === IL) return 200
  return slot
}
