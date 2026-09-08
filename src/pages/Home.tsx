import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listSeasons, seasonIndex, useSeason } from '../data/loadSeason'
import SeasonPicker from '../components/SeasonPicker'
import StandingsTable from '../components/StandingsTable'
import type { StandingsMode } from '../lib/standings'

export default function Home() {
  const params = useParams<{ season?: string }>()
  const seasonId = params.season ? Number(params.season) : seasonIndex.currentSeason
  const { data, loading, missing } = useSeason(seasonId)
  const [mode, setMode] = useState<StandingsMode>('auto')

  if (loading) return <p className="muted">Loading {seasonId}…</p>
  if (missing || !data) {
    return (
      <p className="muted">
        No data for {seasonId}. <Link to="/history">See available seasons.</Link>
      </p>
    )
  }

  const { status, league } = data
  const subtitle = status.isComplete
    ? mode === 'regular'
      ? 'Regular season standings (playoff seeding)'
      : 'Final standings after the playoffs'
    : `Matchup period ${status.currentMatchupPeriod} · through scoring period ${status.latestScoringPeriod} of ${status.finalScoringPeriod}`

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>{seasonId} Standings</h2>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="controls">
          {status.isComplete && (
            <div className="seg">
              <button className={mode !== 'regular' ? 'on' : ''} onClick={() => setMode('auto')}>
                Final
              </button>
              <button className={mode === 'regular' ? 'on' : ''} onClick={() => setMode('regular')}>
                Regular season
              </button>
            </div>
          )}
          <SeasonPicker seasons={listSeasons()} value={seasonId} to={(s) => `/standings/${s}`} />
        </div>
      </div>

      <StandingsTable season={data} mode={mode} />

      <p className="muted small">
        {league.isCategoryBased && (
          <>
            Head-to-head categories: {league.categories.map((c) => c.name).join(', ')}. Records count categories won, lost and
            tied. ★ marks the division leader; the line marks the {league.playoffTeamCount}-team playoff cut.{' '}
          </>
        )}
        <Link to={`/season/${seasonId}`}>Season detail →</Link>
      </p>
    </section>
  )
}
