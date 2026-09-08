import type { LeagueInfo, MatchupSide, SeasonData, Team } from '../types/derived'

export function recordString(r: { wins: number; losses: number; ties: number }): string {
  return r.ties ? `${r.wins}-${r.losses}-${r.ties}` : `${r.wins}-${r.losses}`
}

/** 0.6234 -> ".623" */
export function pctString(p: number): string {
  return p.toFixed(3).replace(/^0/, '')
}

/**
 * A side's score in a matchup. Category leagues: categories won.
 * Points leagues: total points to one decimal.
 */
export function scoreString(side: MatchupSide | null, league: LeagueInfo): string {
  if (!side) return '—'
  if (league.isCategoryBased) {
    return side.categoryRecord ? String(side.categoryRecord.wins) : '0'
  }
  return side.totalPoints.toFixed(1)
}

export function teamById(season: SeasonData, id: number | undefined): Team | undefined {
  if (id === undefined) return undefined
  return season.teams.find((t) => t.id === id)
}

export function ownerLabel(team: Team): string {
  return team.ownerNames.join(' / ')
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** "Categories" vs "Record" header label. */
export function recordHeader(league: LeagueInfo): string {
  return league.isCategoryBased ? 'Cat W-L-T' : 'W-L-T'
}
