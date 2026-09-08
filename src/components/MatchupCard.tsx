import { useState } from 'react'
import { useMyTeam } from '../data/myTeam'
import { scoreString, statValue, teamById } from '../lib/format'
import type { Matchup, SeasonData } from '../types/derived'
import ManagerLabel from './ManagerLabel'

export function tierLabel(tier: string): string {
  switch (tier) {
    case 'WINNERS_BRACKET':
      return 'Playoffs'
    case 'WINNERS_CONSOLATION_LADDER':
      return 'Consolation'
    case 'LOSERS_CONSOLATION_LADDER':
      return 'Toilet bowl'
    case 'NONE':
      return ''
    default:
      return tier.replaceAll('_', ' ').toLowerCase()
  }
}

interface Props {
  m: Matchup
  season: SeasonData
  /** Start with the category breakdown open. */
  open?: boolean
}

export default function MatchupCard({ m, season, open = false }: Props) {
  const [expanded, setExpanded] = useState(open)
  const { franchiseId: mine } = useMyTeam()
  const home = teamById(season, m.home.teamId)
  const away = m.away ? teamById(season, m.away.teamId) : undefined
  const league = season.league
  const involvesMine = mine !== null && (home?.franchiseId === mine || away?.franchiseId === mine)

  if (!m.away) {
    return (
      <li className={`matchup bye${involvesMine ? ' mine' : ''}`}>
        <span className="side">{home && <ManagerLabel franchiseId={home.franchiseId} managerName={home.managerName} teamName={home.name} />}</span>
        <span className="score muted">BYE</span>
        <span className="side" />
      </li>
    )
  }

  const ties = league.isCategoryBased ? (m.home.categoryRecord?.ties ?? 0) : 0
  const homeWon = m.winner === 'HOME'
  const awayWon = m.winner === 'AWAY'
  const canExpand = Boolean(m.home.stats && m.away.stats)

  return (
    <li className={`matchup${m.isPlayoff ? ' playoff' : ''}${involvesMine ? ' mine' : ''}${expanded ? ' open' : ''}`}>
      <div className="matchup-row" onClick={() => canExpand && setExpanded((v) => !v)} role={canExpand ? 'button' : undefined}>
        <span className={`side${awayWon ? ' won' : ''}`}>
          {away && <ManagerLabel franchiseId={away.franchiseId} managerName={away.managerName} teamName={away.name} />}
        </span>
        <span className="score">
          <b className={awayWon ? 'won' : undefined}>{scoreString(m.away, league)}</b>
          <span className="dash">–</span>
          <b className={homeWon ? 'won' : undefined}>{scoreString(m.home, league)}</b>
          {ties > 0 && <small className="muted">{ties} tie{ties > 1 ? 's' : ''}</small>}
          {m.winner === 'TIE' && <small className="muted">tie</small>}
          {m.winner === 'UNDECIDED' && !season.status.isComplete && <small className="muted">live</small>}
          {m.isPlayoff && <span className="badge">{tierLabel(m.playoffTierType)}</span>}
          {canExpand && <span className="chev muted">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className={`side right${homeWon ? ' won' : ''}`}>
          {home && <ManagerLabel franchiseId={home.franchiseId} managerName={home.managerName} teamName={home.name} />}
        </span>
      </div>
      {expanded && canExpand && <CategoryBreakdown m={m} season={season} />}
    </li>
  )
}

function CategoryBreakdown({ m, season }: { m: Matchup; season: SeasonData }) {
  const ids = season.league.statIds
  const away = m.away!
  return (
    <table className="cats">
      <tbody>
        {season.league.categories.map((c) => {
          const i = ids.indexOf(c.statId)
          const hv = m.home.stats?.[i]
          const av = away.stats?.[i]
          const hr = m.home.results?.[i]
          const ar = away.results?.[i]
          return (
            <tr key={c.statId}>
              <td className={`num ${ar === 'W' ? 'won' : ar === 'L' ? 'lost' : ''}`}>{statValue(c.statId, av)}</td>
              <th>
                {c.name}
                {c.isReverse && <span className="muted" title="lower is better">↓</span>}
              </th>
              <td className={`num ${hr === 'W' ? 'won' : hr === 'L' ? 'lost' : ''}`}>{statValue(c.statId, hv)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
