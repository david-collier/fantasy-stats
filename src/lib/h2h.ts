/**
 * Head-to-head records between franchises (team slots) across seasons.
 */
import type { SeasonData } from '../types/derived'

export type H2HScope = 'all' | 'regular' | 'playoffs'

export interface H2HCell {
  /** category record from the row franchise's perspective */
  catWins: number
  catLosses: number
  catTies: number
  /** matchup record */
  wins: number
  losses: number
  ties: number
  games: number
}

export type H2HMatrix = Map<number, Map<number, H2HCell>>

function empty(): H2HCell {
  return { catWins: 0, catLosses: 0, catTies: 0, wins: 0, losses: 0, ties: 0, games: 0 }
}

function inScope(scope: H2HScope, isPlayoff: boolean, tier: string): boolean {
  if (scope === 'all') return true
  if (scope === 'regular') return !isPlayoff
  return tier === 'WINNERS_BRACKET'
}

export function headToHead(seasons: SeasonData[], scope: H2HScope): H2HMatrix {
  const m: H2HMatrix = new Map()
  const cell = (a: number, b: number) => {
    let row = m.get(a)
    if (!row) m.set(a, (row = new Map()))
    let c = row.get(b)
    if (!c) row.set(b, (c = empty()))
    return c
  }
  for (const s of seasons) {
    const lastComplete = s.status.isComplete ? Infinity : s.status.currentMatchupPeriod - 1
    for (const mu of s.matchups) {
      if (!mu.away || mu.matchupPeriodId > lastComplete) continue
      if (!inScope(scope, mu.isPlayoff, mu.playoffTierType)) continue
      if (mu.winner === 'UNDECIDED') continue
      const h = mu.home
      const a = mu.away
      const hc = cell(h.teamId, a.teamId)
      const ac = cell(a.teamId, h.teamId)
      hc.games++
      ac.games++
      hc.catWins += h.categoryRecord?.wins ?? 0
      hc.catLosses += h.categoryRecord?.losses ?? 0
      hc.catTies += h.categoryRecord?.ties ?? 0
      ac.catWins += a.categoryRecord?.wins ?? 0
      ac.catLosses += a.categoryRecord?.losses ?? 0
      ac.catTies += a.categoryRecord?.ties ?? 0
      if (mu.winner === 'HOME') {
        hc.wins++
        ac.losses++
      } else if (mu.winner === 'AWAY') {
        ac.wins++
        hc.losses++
      } else {
        hc.ties++
        ac.ties++
      }
    }
  }
  return m
}

export function catPct(c: H2HCell): number {
  const n = c.catWins + c.catLosses + c.catTies
  return n ? (c.catWins + 0.5 * c.catTies) / n : 0.5
}
