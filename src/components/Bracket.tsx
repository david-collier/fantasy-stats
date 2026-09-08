import { Link } from 'react-router-dom'
import { useMyTeam, mineClass } from '../data/myTeam'
import { scoreString, teamById } from '../lib/format'
import type { Matchup, SeasonData } from '../types/derived'

/**
 * Playoff bracket (winners' bracket only) laid out one column per round.
 * ESPN represents first-round byes as a matchup with no away side.
 */
export default function Bracket({ season }: { season: SeasonData }) {
  const games = season.matchups.filter((m) => m.playoffTierType === 'WINNERS_BRACKET')
  if (!games.length) return <p className="muted">No playoff bracket available for this season.</p>
  const rounds = [...new Set(games.map((g) => g.matchupPeriodId))].sort((a, b) => a - b)
  const names = ['Quarterfinals', 'Semifinals', 'Final']
  const offset = Math.max(0, names.length - rounds.length)
  return (
    <div className="bracket">
      {rounds.map((p, i) => (
        <div className="round" key={p}>
          <h4>
            {names[i + offset] ?? `Round ${i + 1}`} <small className="muted">· week {p}</small>
          </h4>
          {games
            .filter((g) => g.matchupPeriodId === p)
            .sort((a, b) => seedOf(season, a) - seedOf(season, b))
            .map((g) => (
              <BracketGame key={g.id} g={g} season={season} isFinal={i === rounds.length - 1} />
            ))}
        </div>
      ))}
    </div>
  )
}

function seedOf(season: SeasonData, g: Matchup): number {
  const h = teamById(season, g.home.teamId)?.playoffSeed ?? 99
  const a = g.away ? teamById(season, g.away.teamId)?.playoffSeed ?? 99 : 99
  return Math.min(h, a)
}

function BracketGame({ g, season, isFinal }: { g: Matchup; season: SeasonData; isFinal: boolean }) {
  const { franchiseId: mine } = useMyTeam()
  const home = teamById(season, g.home.teamId)
  const away = g.away ? teamById(season, g.away.teamId) : undefined
  const isBye = !g.away
  const homeWon = g.winner === 'HOME' || isBye
  const awayWon = g.winner === 'AWAY'
  const line = (team: typeof home, side: Matchup['home'] | null, won: boolean) =>
    team ? (
      <div className={mineClass(mine, team.franchiseId, `slot${won ? ' won' : ''}`)}>
        <span className="seed">{team.playoffSeed || ''}</span>
        <Link to={`/team/${team.franchiseId}`}>{team.managerName}</Link>
        <span className="pts">{side && !isBye ? scoreString(side, season.league) : ''}</span>
        {won && isFinal && season.status.isComplete && <span title="Champion">🏆</span>}
      </div>
    ) : null
  return (
    <div className="game">
      {line(home, g.home, homeWon)}
      {away ? line(away, g.away, awayWon) : <div className="slot bye muted">bye</div>}
      <Link className="detail muted" to={`/matchups/${season.seasonId}/${g.matchupPeriodId}`}>
        details
      </Link>
    </div>
  )
}
