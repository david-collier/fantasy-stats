import { Link, useNavigate, useParams } from 'react-router-dom'
import { listSeasons, seasonIndex, useSeason } from '../data/loadSeason'
import { scoreString, teamById } from '../lib/format'
import SeasonPicker from '../components/SeasonPicker'
import TeamLogo from '../components/TeamLogo'
import type { Matchup, SeasonData } from '../types/derived'

export default function Matchups() {
  const params = useParams<{ season?: string; period?: string }>()
  const navigate = useNavigate()
  const seasonId = params.season ? Number(params.season) : seasonIndex.currentSeason
  const { data, loading, missing } = useSeason(seasonId)

  if (loading) return <p className="muted">Loading {seasonId}…</p>
  if (missing || !data) {
    return (
      <p className="muted">
        No data for {seasonId}. <Link to="/history">See available seasons.</Link>
      </p>
    )
  }

  const periods = [...new Set(data.matchups.map((m) => m.matchupPeriodId))].sort((a, b) => a - b)
  const defaultPeriod = data.status.isComplete
    ? periods[periods.length - 1]
    : Math.min(data.status.currentMatchupPeriod || 1, periods[periods.length - 1] ?? 1)
  const period = params.period ? Number(params.period) : defaultPeriod
  const rows = data.matchups.filter((m) => m.matchupPeriodId === period)

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>{seasonId} Matchups</h2>
          <p className="muted">{periodLabel(data, period)}</p>
        </div>
        <div className="controls">
          <SeasonPicker seasons={listSeasons()} value={seasonId} to={(s) => `/matchups/${s}`} />
          <label>
            Period{' '}
            <select value={period} onChange={(e) => navigate(`/matchups/${seasonId}/${e.target.value}`)}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {p > data.league.regularSeasonMatchupCount ? ' (playoffs)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {rows.length === 0 && <p className="muted">No matchups in period {period}.</p>}

      <ul className="matchups">
        {rows.map((m) => (
          <MatchupRow key={m.id} m={m} season={data} />
        ))}
      </ul>
    </section>
  )
}

function periodLabel(season: SeasonData, period: number): string {
  const days = season.league.matchupPeriodLengths?.[String(period)]
  const span = days && days.length ? `scoring periods ${days[0]}–${days[days.length - 1]}` : ''
  const kind = period > season.league.regularSeasonMatchupCount ? 'Playoffs' : 'Regular season'
  return [kind, span].filter(Boolean).join(' · ')
}

function MatchupRow({ m, season }: { m: Matchup; season: SeasonData }) {
  const home = teamById(season, m.home.teamId)
  const away = m.away ? teamById(season, m.away.teamId) : undefined
  const league = season.league

  if (!m.away) {
    return (
      <li className="matchup bye">
        <span className="side">{home?.name ?? `Team ${m.home.teamId}`}</span>
        <span className="score muted">BYE</span>
        <span className="side" />
      </li>
    )
  }

  const ties = league.isCategoryBased ? m.home.categoryRecord?.ties ?? 0 : 0
  const homeWon = m.winner === 'HOME'
  const awayWon = m.winner === 'AWAY'

  return (
    <li className={`matchup${m.isPlayoff ? ' playoff' : ''}`}>
      <span className={`side${awayWon ? ' won' : ''}`}>
        <TeamLogo src={away?.logo} size={20} />
        {away?.name ?? `Team ${m.away.teamId}`}
        <small className="muted">{away?.ownerNames.join(' / ')}</small>
      </span>
      <span className="score">
        <b className={awayWon ? 'won' : undefined}>{scoreString(m.away, league)}</b>
        <span className="dash">–</span>
        <b className={homeWon ? 'won' : undefined}>{scoreString(m.home, league)}</b>
        {ties > 0 && <small className="muted">{ties} tie{ties > 1 ? 's' : ''}</small>}
        {m.winner === 'TIE' && <small className="muted">tie</small>}
        {m.winner === 'UNDECIDED' && !season.status.isComplete && <small className="muted">live</small>}
        {m.isPlayoff && <span className="badge">{tierLabel(m.playoffTierType)}</span>}
      </span>
      <span className={`side right${homeWon ? ' won' : ''}`}>
        {home?.name ?? `Team ${m.home.teamId}`}
        <small className="muted">{home?.ownerNames.join(' / ')}</small>
        <TeamLogo src={home?.logo} size={20} />
      </span>
    </li>
  )
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'WINNERS_BRACKET':
      return 'Playoffs'
    case 'WINNERS_CONSOLATION_LADDER':
      return 'Consolation'
    case 'LOSERS_CONSOLATION_LADDER':
      return 'Toilet bowl'
    default:
      return tier.replaceAll('_', ' ').toLowerCase()
  }
}
