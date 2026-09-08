import { Link, useParams } from 'react-router-dom'
import { listSeasons, seasonIndex, useSeason } from '../data/loadSeason'
import { ownerLabel, pctString, recordHeader, recordString } from '../lib/format'
import { sortStandings } from '../lib/standings'
import SeasonPicker from '../components/SeasonPicker'
import TeamLogo from '../components/TeamLogo'

export default function Home() {
  const params = useParams<{ season?: string }>()
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

  const teams = sortStandings(data.teams)
  const { status, league } = data
  const subtitle = status.isComplete
    ? 'Final standings'
    : `Matchup period ${status.currentMatchupPeriod} · through scoring period ${status.latestScoringPeriod} of ${status.finalScoringPeriod}`
  const showPoints = league.isPointsBased
  const showGamesBack = !status.isComplete && teams.some((t) => t.record.gamesBack !== undefined)

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>{seasonId} Standings</h2>
          <p className="muted">{subtitle}</p>
        </div>
        <SeasonPicker seasons={listSeasons()} value={seasonId} to={(s) => `/standings/${s}`} />
      </div>

      <table className="data">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Team</th>
            <th>Owner</th>
            <th className="num">{recordHeader(league)}</th>
            <th className="num">Pct</th>
            {showGamesBack && <th className="num">GB</th>}
            {showPoints && <th className="num">PF</th>}
            {showPoints && <th className="num">PA</th>}
            {!status.isComplete && <th className="num">Seed</th>}
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const rank = status.isComplete && t.finalRank ? t.finalRank : i + 1
            const inPlayoffs = !status.isComplete && t.playoffSeed > 0 && t.playoffSeed <= league.playoffTeamCount
            return (
              <tr key={t.id} className={rank === 1 && status.isComplete ? 'champion' : undefined}>
                <td className="num">{rank}</td>
                <td>
                  <span className="team">
                    <TeamLogo src={t.logo} />
                    <span>
                      {t.name}
                      {rank === 1 && status.isComplete && <span title="Champion"> 🏆</span>}
                    </span>
                  </span>
                </td>
                <td className="muted">{ownerLabel(t)}</td>
                <td className="num">{recordString(t.record)}</td>
                <td className="num">{pctString(t.record.percentage)}</td>
                {showGamesBack && <td className="num">{t.record.gamesBack === 0 ? '—' : t.record.gamesBack}</td>}
                {showPoints && <td className="num">{t.record.pointsFor.toFixed(1)}</td>}
                {showPoints && <td className="num">{t.record.pointsAgainst.toFixed(1)}</td>}
                {!status.isComplete && (
                  <td className="num">{t.playoffSeed || '—'}{inPlayoffs && <span className="badge">PO</span>}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {league.isCategoryBased && (
        <p className="muted small">
          Head-to-head categories: {league.categories.map((c) => c.name).join(', ')}. Record counts categories won,
          lost, and tied across all matchups.
        </p>
      )}
    </section>
  )
}
