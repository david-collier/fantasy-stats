/**
 * Normalized league data written by scripts/derive.ts and read by the UI.
 * Shared by both sides so schema drift is a compile error, not a runtime bug.
 */

export type ScoringType =
  | 'H2H_CATEGORY'
  | 'H2H_MOST_CATEGORIES'
  | 'H2H_POINTS'
  | 'ROTO'
  | 'TOTAL_SEASON_POINTS'
  | (string & {}) // keep open: ESPN may add values

export interface ScoringCategory {
  statId: number
  name: string // e.g. "HR", "ERA" (from constants.STATS_MAP; falls back to "stat_<id>")
  isReverse: boolean // true when lower is better (ERA, WHIP)
}

export interface LeagueInfo {
  id: number
  name: string
  size: number
  scoringType: ScoringType
  isPointsBased: boolean
  isCategoryBased: boolean
  regularSeasonMatchupCount: number
  playoffTeamCount: number
  categories: ScoringCategory[]
  /** matchupPeriodId -> scoringPeriodIds. Useful for daily drill-down later. */
  matchupPeriodLengths?: Record<string, number[]>
}

export interface SeasonStatus {
  currentMatchupPeriod: number
  latestScoringPeriod: number
  finalScoringPeriod: number
  firstScoringPeriod: number
  isActive: boolean
  isComplete: boolean
  previousSeasons: number[]
}

export interface Member {
  id: string // SWID GUID with braces
  displayName: string
  firstName?: string
  lastName?: string
}

export interface TeamRecord {
  wins: number
  losses: number
  ties: number
  percentage: number
  pointsFor: number
  pointsAgainst: number
  gamesBack?: number
}

export interface Team {
  id: number
  abbrev: string
  name: string
  logo?: string
  divisionId?: number
  primaryOwnerId?: string
  ownerIds: string[]
  /** Resolved via members[]: "First Last", falling back to displayName. */
  ownerNames: string[]
  record: TeamRecord
  playoffSeed: number
  /** rankCalculatedFinal; 0 while the season is live. */
  finalRank: number
  currentProjectedRank?: number
}

export type MatchupWinner = 'HOME' | 'AWAY' | 'TIE' | 'UNDECIDED'

export interface MatchupSide {
  teamId: number
  /** Points leagues: the score. Category leagues: 0. */
  totalPoints: number
  /** Category leagues: categories won/lost/tied in this matchup. */
  categoryRecord?: { wins: number; losses: number; ties: number }
}

export interface Matchup {
  id: number
  matchupPeriodId: number
  playoffTierType: string // 'NONE' | 'WINNERS_BRACKET' | 'LOSERS_CONSOLATION_LADDER' | 'WINNERS_CONSOLATION_LADDER' | ...
  isPlayoff: boolean
  winner: MatchupWinner
  home: MatchupSide
  /** null = bye */
  away: MatchupSide | null
}

export interface SeasonData {
  schemaVersion: 1
  seasonId: number
  fetchedAt: string // ISO
  league: LeagueInfo
  status: SeasonStatus
  members: Member[]
  teams: Team[]
  matchups: Matchup[]
  championTeamId: number | null
}

export type SeasonFetchStatus = 'ok' | 'unauthorized' | 'not_found' | 'error'

export interface SeasonIndexEntry {
  seasonId: number
  status: SeasonFetchStatus
  httpStatus?: number
  isCurrent: boolean
  isComplete?: boolean
  championTeamId?: number | null
  championName?: string | null
}

export interface SeasonIndex {
  leagueId: number
  leagueName: string
  lastUpdated: string // ISO; only bumped when some data file actually changed
  currentSeason: number
  seasons: SeasonIndexEntry[]
}
