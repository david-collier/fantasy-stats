import type { LeagueInfo, MatchupSide, PlayerRef, SeasonData, Team } from '../types/derived'
import { DEFAULT_POSITION_MAP, POSITION_MAP, PRO_TEAM_MAP } from '../../scripts/constants'

export function recordString(r: { wins: number; losses: number; ties: number }): string {
  return r.ties ? `${r.wins}-${r.losses}-${r.ties}` : `${r.wins}-${r.losses}`
}

/** 0.6234 -> ".623" */
export function pctString(p: number): string {
  return p.toFixed(3).replace(/^0/, '')
}

export function pct(w: number, l: number, t = 0): number {
  const n = w + l + t
  return n ? (w + 0.5 * t) / n : 0
}

export function scoreString(side: MatchupSide | null, league: LeagueInfo): string {
  if (!side) return '—'
  if (league.isCategoryBased) return side.categoryRecord ? String(side.categoryRecord.wins) : '0'
  return side.totalPoints.toFixed(1)
}

export function teamById(season: SeasonData, id: number | undefined): Team | undefined {
  if (id === undefined) return undefined
  return season.teams.find((t) => t.id === id)
}

export function formatDate(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDay(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function recordHeader(league: LeagueInfo): string {
  return league.isCategoryBased ? 'Cat W-L-T' : 'W-L-T'
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function signed(n: number, digits = 1): string {
  const s = n.toFixed(digits)
  return n > 0 ? `+${s}` : s
}

/** Lineup slot id -> label (C, 1B, ..., UTIL, P, SP, RP, BE, IL). */
export function slotName(id: number | undefined): string {
  return id === undefined ? '' : POSITION_MAP[id] ?? `#${id}`
}

/** Player defaultPositionId -> label (SP, C, 1B, ..., DH, RP). Different numbering from slots. */
export function positionName(id: number | undefined): string {
  return id === undefined ? '' : DEFAULT_POSITION_MAP[id] ?? `#${id}`
}

/** Player defaultPositionId: 1 = SP, 11 = RP. */
export function isPitcherPosition(id: number | undefined): boolean {
  return id === 1 || id === 11
}

export function proTeamName(id: number | undefined): string {
  return id === undefined ? '' : PRO_TEAM_MAP[id] ?? ''
}

export function playerLabel(p: PlayerRef | undefined, id: number): string {
  return p?.name ?? `Player #${id}`
}

/** Format a stat value for display given its id (rates get 3 decimals / 2 for ERA & WHIP). */
export function statValue(statId: number, v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return '—'
  if (statId === 17 || statId === 9) return v.toFixed(3).replace(/^0/, '')
  if (statId === 47 || statId === 41) return v.toFixed(2)
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function acquisitionLabel(type: string): string {
  switch (type) {
    case 'DRAFT':
      return 'Draft'
    case 'ADD':
      return 'Free agent'
    case 'TRADE':
      return 'Trade'
    case 'UNKNOWN':
      return 'Unknown'
    default:
      return type.charAt(0) + type.slice(1).toLowerCase()
  }
}
