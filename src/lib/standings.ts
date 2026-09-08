import type { SeasonData, Team } from '../types/derived'

export type StandingsMode = 'auto' | 'final' | 'regular'

/**
 * Order teams the way ESPN's standings page does:
 *  - final:   by rankCalculatedFinal (playoff results)
 *  - regular: by playoff seed (ESPN's regular-season standings position), falling back to pct
 *  - auto:    final when the season is complete, otherwise regular
 */
export function sortStandings(season: SeasonData, mode: StandingsMode = 'auto'): Team[] {
  const t = [...season.teams]
  const useFinal = mode === 'final' || (mode === 'auto' && season.status.isComplete && t.some((x) => x.finalRank > 0))
  if (useFinal && t.some((x) => x.finalRank > 0)) {
    return t.sort((a, b) => (a.finalRank || 99) - (b.finalRank || 99))
  }
  if (t.some((x) => x.playoffSeed > 0)) {
    return t.sort((a, b) => (a.playoffSeed || 99) - (b.playoffSeed || 99))
  }
  return t.sort((a, b) => b.record.percentage - a.record.percentage || b.record.pointsFor - a.record.pointsFor)
}

export function divisionName(season: SeasonData, divisionId: number | undefined): string | undefined {
  if (divisionId === undefined) return undefined
  return season.league.divisions.find((d) => d.id === divisionId)?.name
}

/** Winner of each division by regular-season seed. */
export function divisionWinners(season: SeasonData): Set<number> {
  const best = new Map<number, Team>()
  for (const t of season.teams) {
    if (t.divisionId === undefined) continue
    const cur = best.get(t.divisionId)
    if (!cur || (t.playoffSeed || 99) < (cur.playoffSeed || 99)) best.set(t.divisionId, t)
  }
  return new Set([...best.values()].map((t) => t.id))
}
