import { Link, useNavigate, useParams } from 'react-router-dom'
import { listSeasons, seasonIndex, useSeason } from '../data/loadSeason'
import SeasonPicker from '../components/SeasonPicker'
import MatchupCard from '../components/MatchupCard'
import type { SeasonData } from '../types/derived'

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
  const last = periods[periods.length - 1] ?? 1
  const defaultPeriod = data.status.isComplete ? last : Math.min(data.status.currentMatchupPeriod || 1, last)
  const period = params.period ? Number(params.period) : defaultPeriod
  const rows = data.matchups.filter((m) => m.matchupPeriodId === period)
  const idx = periods.indexOf(period)

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>{seasonId} Matchups</h2>
          <p className="muted">{periodLabel(data, period)} · click a matchup for the category breakdown</p>
        </div>
        <div className="controls">
          <SeasonPicker seasons={listSeasons()} value={seasonId} to={(s) => `/matchups/${s}`} />
          <label>
            Week{' '}
            <select value={period} onChange={(e) => navigate(`/matchups/${seasonId}/${e.target.value}`)}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {p > data.league.regularSeasonMatchupCount ? ' (playoffs)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="seg">
            <button disabled={idx <= 0} onClick={() => navigate(`/matchups/${seasonId}/${periods[idx - 1]}`)}>
              ‹
            </button>
            <button disabled={idx < 0 || idx >= periods.length - 1} onClick={() => navigate(`/matchups/${seasonId}/${periods[idx + 1]}`)}>
              ›
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 && <p className="muted">No matchups in week {period}.</p>}

      <ul className="matchups">
        {rows.map((m) => (
          <MatchupCard key={m.id} m={m} season={data} />
        ))}
      </ul>
      <p className="muted small">
        <Link to={`/season/${seasonId}`}>Season detail →</Link>
      </p>
    </section>
  )
}

export function periodLabel(season: SeasonData, period: number): string {
  const days = season.league.matchupPeriodLengths?.[String(period)]
  const span = days && days.length ? `scoring periods ${days[0]}–${days[days.length - 1]}` : ''
  const kind = period > season.league.regularSeasonMatchupCount ? 'Playoffs' : 'Regular season'
  return [kind, span].filter(Boolean).join(' · ')
}
