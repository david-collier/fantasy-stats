import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listSeasons, usePlayers, useSeason, useSeasonTx } from '../data/loadSeason'
import { useMyTeam, mineClass } from '../data/myTeam'
import Bracket from '../components/Bracket'
import ManagerLabel from '../components/ManagerLabel'
import SeasonPicker from '../components/SeasonPicker'
import StandingsTable from '../components/StandingsTable'
import TradeCard from '../components/TradeCard'
import { ordinal, recordString } from '../lib/format'
import { trades } from '../lib/timeline'

export default function SeasonDetail() {
  const params = useParams<{ season: string }>()
  const seasonId = Number(params.season)
  const { data, loading, missing } = useSeason(seasonId)
  const tx = useSeasonTx(seasonId)
  const players = usePlayers()
  const { franchiseId: mine } = useMyTeam()
  const [showDraft, setShowDraft] = useState(false)

  if (loading) return <p className="muted">Loading {seasonId}…</p>
  if (missing || !data) return <p className="muted">No data for {seasonId}.</p>

  const podium = [1, 2, 3].map((r) => data.teams.find((t) => t.finalRank === r))
  const periods = [...new Set(data.matchups.map((m) => m.matchupPeriodId))].sort((a, b) => a - b)
  const tradeList = trades(tx.data)
  const draftByRound = new Map<number, typeof data.draft>()
  for (const p of data.draft) draftByRound.set(p.round, [...(draftByRound.get(p.round) ?? []), p])

  return (
    <section className="season-detail">
      <div className="page-head">
        <div>
          <h2>{seasonId} Season</h2>
          <p className="muted">
            {data.status.isComplete ? 'Complete' : `In progress · week ${data.status.currentMatchupPeriod}`} · {data.league.regularSeasonMatchupCount} regular-season weeks ·{' '}
            {data.league.playoffTeamCount}-team playoffs · {data.league.divisions.map((d) => d.name).join(' / ')} divisions
          </p>
        </div>
        <SeasonPicker seasons={listSeasons()} value={seasonId} to={(s) => `/season/${s}`} />
      </div>

      {data.status.isComplete && podium[0] && (
        <div className="podium">
          {podium.map((t, i) =>
            t ? (
              <div key={t.id} className={mineClass(mine, t.franchiseId, `place p${i + 1}`)}>
                <div className="medal">{['🥇', '🥈', '🥉'][i]}</div>
                <ManagerLabel franchiseId={t.franchiseId} managerName={t.managerName} teamName={t.name} />
                <small className="muted">
                  {ordinal(i + 1)} · {recordString(t.record)} · seed {t.playoffSeed}
                </small>
              </div>
            ) : null,
          )}
        </div>
      )}

      <h3>Playoff bracket</h3>
      <Bracket season={data} />

      <div className="two-col">
        <div>
          <h3>{data.status.isComplete ? 'Final standings' : 'Standings'}</h3>
          <StandingsTable season={data} mode="auto" />
        </div>
        {data.status.isComplete && (
          <div>
            <h3>Regular season standings</h3>
            <StandingsTable season={data} mode="regular" />
          </div>
        )}
      </div>

      <h3>Matchup weeks</h3>
      <div className="chips">
        {periods.map((p) => (
          <Link key={p} to={`/matchups/${seasonId}/${p}`} className={`chip${p > data.league.regularSeasonMatchupCount ? ' playoff' : ''}`}>
            {p}
          </Link>
        ))}
      </div>

      <h3>
        Trades <small className="muted">({tradeList.length})</small>
      </h3>
      {!data.hasTransactions && <p className="muted small">ESPN has no transaction log for this season; only drafts and end-of-season rosters are available.</p>}
      {tradeList.length > 0 && (
        <div className="trades">
          {tradeList.map((t) => (
            <TradeCard key={t.id} t={t} season={data} tx={tx.data} players={players.data} />
          ))}
        </div>
      )}

      <h3>
        Draft{' '}
        <button className="linkish" onClick={() => setShowDraft((v) => !v)}>
          {showDraft ? 'hide' : `show ${data.draft.length} picks`}
        </button>
      </h3>
      <p className="muted small">
        {data.draft.filter((p) => p.keeper).length} keeper selections · {data.league.keeperCount ?? '?'} keepers per team
      </p>
      {showDraft && (
        <div className="draft">
          {[...draftByRound.entries()].map(([round, picks]) => (
            <div key={round} className="round-block">
              <h5>Round {round}</h5>
              <ol>
                {picks.map((p) => {
                  const t = data.teams.find((x) => x.id === p.teamId)
                  const name = data.players[String(p.playerId)]?.name ?? players.data?.[String(p.playerId)]?.name ?? `Player #${p.playerId}`
                  return (
                    <li key={p.overall} className={mineClass(mine, t?.franchiseId)}>
                      <span className="muted num">{p.overall}</span> <Link to={`/player/${p.playerId}`}>{name}</Link>
                      {p.keeper && <span className="badge keeper">K</span>} <small className="muted">{t?.managerShort}</small>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
