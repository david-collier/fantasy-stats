/**
 * Normalized league data written by scripts/derive.ts (+ scripts/crossSeason.ts)
 * and read by the UI. Shared by both sides so schema drift is a compile error.
 *
 * Files:
 *   data/derived/index.json          SeasonIndex
 *   data/derived/<season>.json       SeasonData
 *   data/derived/<season>-tx.json    SeasonTransactions
 *   data/derived/league.json         LeagueSummary (franchises across seasons)
 *   data/derived/players.json        PlayerDirectory (id -> name/position, all seasons)
 */

export type ScoringType =
  | 'H2H_CATEGORY'
  | 'H2H_MOST_CATEGORIES'
  | 'H2H_POINTS'
  | 'ROTO'
  | 'TOTAL_SEASON_POINTS'
  | (string & {})

export interface ScoringCategory {
  statId: number
  name: string // "HR", "ERA" ...
  isReverse: boolean // lower is better (ERA, WHIP)
  /** 'batting' | 'pitching' (from the stat id range). */
  side: 'batting' | 'pitching'
}

export interface Division {
  id: number
  name: string
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
  divisions: Division[]
  /** Stat ids present in matchup scoreByStat, in the order used by MatchupSide.stats. */
  statIds: number[]
  /** matchupPeriodId -> scoringPeriodIds */
  matchupPeriodLengths?: Record<string, number[]>
  keeperCount?: number
  draftDate?: number // epoch ms
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
  id: string
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
  /** Franchise = team slot; stable across seasons even when the manager changes. */
  franchiseId: number
  abbrev: string
  name: string
  logo?: string
  divisionId?: number
  primaryOwnerId?: string
  ownerIds: string[]
  /** "First Last" per owner, falling back to displayName. */
  ownerNames: string[]
  /** Primary display label: primary owner's name (or all owners joined). */
  managerName: string
  /** Short label for charts: primary owner's first name. */
  managerShort: string
  record: TeamRecord
  divisionRecord?: { wins: number; losses: number; ties: number }
  playoffSeed: number
  /** rankCalculatedFinal; 0 while the season is live. */
  finalRank: number
  currentProjectedRank?: number
  /** statId -> season total (ESPN valuesByStat). Includes component stats. */
  statTotals: Record<string, number>
}

export type MatchupWinner = 'HOME' | 'AWAY' | 'TIE' | 'UNDECIDED'
export type CatResult = 'W' | 'L' | 'T' | null

export interface MatchupSide {
  teamId: number
  totalPoints: number
  categoryRecord?: { wins: number; losses: number; ties: number }
  /** Values aligned to league.statIds (includes components like AB, H, OUTS). */
  stats?: number[]
  /** Result per stat aligned to league.statIds; null for unscored component stats. */
  results?: CatResult[]
}

export interface Matchup {
  id: number
  matchupPeriodId: number
  playoffTierType: string
  isPlayoff: boolean
  winner: MatchupWinner
  home: MatchupSide
  away: MatchupSide | null
}

export type AcquisitionType = 'DRAFT' | 'ADD' | 'TRADE' | (string & {})

export interface RosterEntry {
  playerId: number
  lineupSlotId: number
  acquisitionType: AcquisitionType
  acquisitionDate: number | null
  injuryStatus?: string
  /** Drafted as a keeper this season (draft pick flagged keeper). */
  keeper: boolean
  /** First season of the unbroken run on this franchise (set by crossSeason pass). */
  keeperSince?: number
  /** How the player first joined the franchise in keeperSince season. */
  originType?: AcquisitionType
  draft?: { round: number; pick: number; overall: number }
}

export interface DraftPick {
  overall: number
  round: number
  pick: number
  teamId: number
  playerId: number
  keeper: boolean
  autoDraft: boolean
}

export interface PlayerRef {
  id: number
  name: string
  positionId: number
  proTeamId: number
  eligibleSlots?: number[]
  /** statId -> season total for this player (only for rostered players). */
  stats?: Record<string, number>
}

export interface SeasonData {
  schemaVersion: 2
  seasonId: number
  fetchedAt: string
  league: LeagueInfo
  status: SeasonStatus
  members: Member[]
  teams: Team[]
  matchups: Matchup[]
  championTeamId: number | null
  /** teamId -> final (or current) roster. */
  rosters: Record<string, RosterEntry[]>
  draft: DraftPick[]
  /** Players referenced by rosters/draft this season. */
  players: Record<string, PlayerRef>
  /** Whether <season>-tx.json has real transaction history. */
  hasTransactions: boolean
}

export type TransactionItemType = 'ADD' | 'DROP' | 'TRADE' | 'LINEUP' | 'DRAFT' | (string & {})

export interface TransactionItem {
  type: TransactionItemType
  playerId: number
  fromTeamId: number
  toTeamId: number
  keeper?: boolean
  overallPick?: number
}

export type TransactionType = 'FREEAGENT' | 'WAIVER' | 'ROSTER' | 'TRADE_ACCEPT' | 'DRAFT' | (string & {})

export interface Transaction {
  id: string
  type: TransactionType
  status: string
  date: number
  /** Team that initiated (for trades: proposer). */
  teamId: number
  scoringPeriodId: number
  items: TransactionItem[]
}

export interface SeasonTransactions {
  seasonId: number
  source: 'playercard' | 'none'
  transactions: Transaction[]
  /** Players referenced by transactions this season (superset of rosters/draft). */
  players: Record<string, PlayerRef>
}

export interface FranchiseSeason {
  seasonId: number
  teamId: number
  teamName: string
  abbrev: string
  managerId?: string
  managerName: string
  managerShort: string
  ownerNames: string[]
  divisionId?: number
  divisionName?: string
  record: TeamRecord
  playoffSeed: number
  finalRank: number
  isComplete: boolean
  champion: boolean
  madePlayoffs: boolean
}

export interface Franchise {
  id: number
  /** Latest season's manager and team name. */
  managerName: string
  managerShort: string
  teamName: string
  seasons: FranchiseSeason[]
}

export interface LeagueSummary {
  leagueId: number
  leagueName: string
  seasons: number[]
  currentSeason: number
  franchises: Franchise[]
}

export type PlayerDirectory = Record<string, PlayerRef>

export type SeasonFetchStatus = 'ok' | 'unauthorized' | 'not_found' | 'error'

export interface SeasonIndexEntry {
  seasonId: number
  status: SeasonFetchStatus
  httpStatus?: number
  isCurrent: boolean
  isComplete?: boolean
  championTeamId?: number | null
  championName?: string | null
  /** Manager of the champion. */
  championManager?: string | null
  /** Final ranks 1..3 as teamIds. */
  podium?: number[]
  hasTransactions?: boolean
}

export interface SeasonIndex {
  leagueId: number
  leagueName: string
  lastUpdated: string
  currentSeason: number
  seasons: SeasonIndexEntry[]
}
