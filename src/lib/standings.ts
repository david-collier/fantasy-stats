import type { Team } from '../types/derived'

/**
 * Order teams the way ESPN's standings page does:
 *  - finished season: by final rank
 *  - live season: by ESPN's playoff seed (its current standings position)
 *  - otherwise: win percentage, then points for
 */
export function sortStandings(teams: Team[]): Team[] {
  const t = [...teams]
  if (t.some((x) => x.finalRank > 0)) {
    return t.sort((a, b) => (a.finalRank || 99) - (b.finalRank || 99))
  }
  if (t.some((x) => x.playoffSeed > 0)) {
    return t.sort((a, b) => (a.playoffSeed || 99) - (b.playoffSeed || 99))
  }
  return t.sort((a, b) => b.record.percentage - a.record.percentage || b.record.pointsFor - a.record.pointsFor)
}
