import { Link, useParams } from 'react-router-dom'
import { useAllSeasons, useAllTx, usePlayers } from '../data/loadSeason'
import ManagerLabel from '../components/ManagerLabel'
import TradeCard from '../components/TradeCard'
import { formatDay, isPitcherPosition, positionName, proTeamName, statValue } from '../lib/format'
import { buildTimeline, type TimelineEvent } from '../lib/timeline'
import type { SeasonData } from '../types/derived'

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  DRAFT: 'Drafted',
  KEEPER: 'Kept',
  ADD: 'Added',
  WAIVER: 'Claimed off waivers',
  DROP: 'Dropped',
  TRADE: 'Traded',
}
const KIND_ICON: Record<TimelineEvent['kind'], string> = { DRAFT: '📋', KEEPER: '🔒', ADD: '➕', WAIVER: '➕', DROP: '➖', TRADE: '🔁' }

export default function PlayerPage() {
  const params = useParams<{ playerId: string }>()
  const playerId = Number(params.playerId)
  const seasons = useAllSeasons()
  const txs = useAllTx()
  const players = usePlayers()

  if (seasons.loading || txs.loading || players.loading) return <p className="muted">Loading history…</p>
  const ref = players.data?.[String(playerId)]
  const events = buildTimeline(playerId, seasons.data ?? [], txs.data ?? [])
  const bySeason = new Map<number, TimelineEvent[]>()
  for (const e of events) bySeason.set(e.seasonId, [...(bySeason.get(e.seasonId) ?? []), e])
  const rosterSeasons = (seasons.data ?? [])
    .map((s) => ({ s, teamId: Object.entries(s.rosters).find(([, r]) => r.some((e) => e.playerId === playerId))?.[0] }))
    .filter((x): x is { s: SeasonData; teamId: string } => Boolean(x.teamId))
  const latest = rosterSeasons[rosterSeasons.length - 1]
  const latestTeam = latest?.s.teams.find((t) => t.id === Number(latest.teamId))
  const pitcher = isPitcherPosition(ref?.positionId)
  const statCats = (rosterSeasons[0]?.s.league.categories ?? []).filter((c) => (pitcher ? c.side === 'pitching' : c.side === 'batting'))

  return (
    <section className="player-page">
      <div className="page-head">
        <div>
          <h2>{ref?.name ?? `Player #${playerId}`}</h2>
          <p className="muted">
            {ref && positionName(ref.positionId)}
            {ref?.proTeamId ? ` · ${proTeamName(ref.proTeamId)}` : ''}
            {latestTeam && (
              <>
                {' · '}
                {latest.s.status.isComplete ? `ended ${latest.s.seasonId} on` : 'currently on'} <Link to={`/team/${latestTeam.franchiseId}`}>{latestTeam.managerName}</Link>
              </>
            )}
          </p>
        </div>
        <Link to="/players" className="muted small">
          ← all players
        </Link>
      </div>

      {events.length === 0 && <p className="muted">No league transactions recorded for this player.</p>}

      <div className="timeline">
        {[...bySeason.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([year, evs]) => {
            const season = seasons.data!.find((s) => s.seasonId === year)!
            const tx = txs.data?.find((t) => t.seasonId === year)
            return (
              <div key={year} className="tl-season">
                <h3>
                  <Link to={`/season/${year}`}>{year}</Link>
                  {!season.hasTransactions && <small className="muted"> · partial (no transaction log)</small>}
                </h3>
                <ol>
                  {[...evs].reverse().map((e, i) => {
                    const team = season.teams.find((t) => t.id === e.teamId)
                    const from = e.fromTeamId !== undefined ? season.teams.find((t) => t.id === e.fromTeamId) : undefined
                    return (
                      <li key={i} className={`tl-${e.kind.toLowerCase()}`}>
                        <span className="icon">{KIND_ICON[e.kind]}</span>
                        <span className="when muted">{e.kind === 'DRAFT' || e.kind === 'KEEPER' ? 'Draft' : formatDay(e.date)}</span>
                        <span className="what">
                          <b>{KIND_LABEL[e.kind]}</b>{' '}
                          {e.kind === 'TRADE' && from && team ? (
                            <>
                              from <ManagerLabel franchiseId={from.franchiseId} managerName={from.managerShort} compact /> to <ManagerLabel franchiseId={team.franchiseId} managerName={team.managerShort} compact />
                            </>
                          ) : team ? (
                            <>
                              {e.kind === 'DROP' ? 'by' : 'by'} <ManagerLabel franchiseId={team.franchiseId} managerName={team.managerShort} compact />
                            </>
                          ) : null}
                          {e.detail && <small className="muted"> · {e.detail}</small>}
                          {e.kind === 'KEEPER' && e.keeperSince && <small className="muted"> · on roster since {e.keeperSince}</small>}
                        </span>
                        {e.transaction?.type === 'TRADE_ACCEPT' && (
                          <div className="tl-trade">
                            <TradeCard t={e.transaction} season={season} tx={tx} players={players.data} highlightPlayerId={playerId} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })}
      </div>

      {rosterSeasons.length > 0 && (
        <>
          <h3>Season stats while rostered</h3>
          <p className="muted small">ESPN season totals for seasons the player finished on a league roster.</p>
          <table className="data">
            <thead>
              <tr>
                <th>Season</th>
                <th>Team</th>
                {statCats.map((c) => (
                  <th key={c.statId} className="num">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rosterSeasons].reverse().map(({ s, teamId }) => {
                const team = s.teams.find((t) => t.id === Number(teamId))
                const p = s.players[String(playerId)]
                return (
                  <tr key={s.seasonId}>
                    <td>{s.seasonId}</td>
                    <td>{team && <ManagerLabel franchiseId={team.franchiseId} managerName={team.managerShort} compact />}</td>
                    {statCats.map((c) => (
                      <td key={c.statId} className="num muted">
                        {statValue(c.statId, p?.stats?.[String(c.statId)])}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
