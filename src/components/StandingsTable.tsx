import { useMyTeam, mineClass } from '../data/myTeam'
import { pctString, recordHeader, recordString } from '../lib/format'
import { divisionName, divisionWinners, sortStandings, type StandingsMode } from '../lib/standings'
import type { SeasonData } from '../types/derived'
import ManagerLabel from './ManagerLabel'

interface Props {
  season: SeasonData
  mode?: StandingsMode
  /** Draw the playoff cut line (default: when not showing final results). */
  playoffLine?: boolean
}

export default function StandingsTable({ season, mode = 'auto', playoffLine }: Props) {
  const { franchiseId: mine } = useMyTeam()
  const teams = sortStandings(season, mode)
  const { league, status } = season
  const showingFinal = mode === 'final' || (mode === 'auto' && status.isComplete)
  const cut = playoffLine ?? !showingFinal
  const winners = divisionWinners(season)
  const showGB = !showingFinal && teams.some((t) => t.record.gamesBack !== undefined)
  const showDivRecord = teams.some((t) => t.divisionRecord)
  const cutIndex = league.playoffTeamCount > 0 ? league.playoffTeamCount - 1 : -1

  return (
    <table className="data standings">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>Manager</th>
          <th>Div</th>
          <th className="num">{recordHeader(league)}</th>
          <th className="num">Pct</th>
          {showGB && <th className="num">GB</th>}
          {showDivRecord && <th className="num">Div W-L</th>}
          {!showingFinal && <th className="num">Seed</th>}
        </tr>
      </thead>
      <tbody>
        {teams.map((t, i) => {
          const rank = showingFinal && t.finalRank ? t.finalRank : i + 1
          const isChamp = showingFinal && status.isComplete && rank === 1
          const classes = [
            isChamp ? 'champion' : undefined,
            cut && i === cutIndex ? 'playoff-cut' : undefined,
            !showingFinal && t.playoffSeed > 0 && t.playoffSeed <= league.playoffTeamCount ? 'in-playoffs' : undefined,
          ]
            .filter(Boolean)
            .join(' ')
          const div = divisionName(season, t.divisionId)
          return (
            <tr key={t.id} className={mineClass(mine, t.franchiseId, classes)}>
              <td className="num">{rank}</td>
              <td>
                <ManagerLabel franchiseId={t.franchiseId} managerName={t.managerName} teamName={t.name} />
                {isChamp && <span title="Champion"> 🏆</span>}
              </td>
              <td>
                {div && (
                  <span className={`badge div div-${t.divisionId}`} title={winners.has(t.id) ? `${div} division leader` : div}>
                    {div}
                    {winners.has(t.id) && !showingFinal ? ' ★' : ''}
                  </span>
                )}
              </td>
              <td className="num">{recordString(t.record)}</td>
              <td className="num">{pctString(t.record.percentage)}</td>
              {showGB && <td className="num">{t.record.gamesBack === 0 ? '—' : t.record.gamesBack}</td>}
              {showDivRecord && <td className="num muted">{t.divisionRecord ? recordString(t.divisionRecord) : '—'}</td>}
              {!showingFinal && <td className="num">{t.playoffSeed || '—'}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
