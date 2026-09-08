/**
 * Minimal typing of the raw ESPN fantasy API payload: only the fields
 * scripts/derive.ts touches. Everything else is preserved verbatim in
 * data/raw/<season>/league.json via the index signatures.
 */

export interface EspnMember {
  id: string
  displayName: string
  firstName?: string
  lastName?: string
}

export interface EspnRecordSplit {
  wins: number
  losses: number
  ties: number
  percentage: number
  pointsFor: number
  pointsAgainst: number
  gamesBack?: number
  streakLength?: number
  streakType?: string
}

export interface EspnPlayer {
  id: number
  fullName: string
  firstName?: string
  lastName?: string
  defaultPositionId: number
  proTeamId: number
  eligibleSlots?: number[]
  stats?: EspnPlayerStats[]
  [k: string]: unknown
}

export interface EspnPlayerStats {
  seasonId: number
  statSourceId: number // 0 actual, 1 projected
  statSplitTypeId: number // 0 season total
  scoringPeriodId: number
  stats: Record<string, number>
  [k: string]: unknown
}

export interface EspnRosterEntry {
  playerId: number
  lineupSlotId: number
  acquisitionType?: string | null
  acquisitionDate?: number | null
  injuryStatus?: string
  status?: string
  playerPoolEntry?: { id: number; player: EspnPlayer; keeperValue?: number; [k: string]: unknown }
  [k: string]: unknown
}

export interface EspnTeam {
  id: number
  abbrev: string
  name?: string
  location?: string
  nickname?: string
  logo?: string
  divisionId?: number
  primaryOwner?: string
  owners?: string[]
  record?: { overall?: EspnRecordSplit; division?: EspnRecordSplit }
  playoffSeed?: number
  rankCalculatedFinal?: number
  currentProjectedRank?: number
  valuesByStat?: Record<string, number>
  roster?: { entries?: EspnRosterEntry[] }
  [k: string]: unknown
}

export interface EspnScoreByStat {
  score: number
  result: 'WIN' | 'LOSS' | 'TIE' | null
  ineligible?: boolean
  rank?: number
}

export interface EspnMatchupSide {
  teamId: number
  totalPoints?: number
  cumulativeScore?: {
    wins: number
    losses: number
    ties: number
    scoreByStat?: Record<string, EspnScoreByStat>
    [k: string]: unknown
  }
  [k: string]: unknown
}

export interface EspnMatchup {
  id: number
  matchupPeriodId: number
  playoffTierType?: string
  winner?: string
  home: EspnMatchupSide
  away?: EspnMatchupSide
  [k: string]: unknown
}

export interface EspnScoringItem {
  statId: number
  isReverseItem?: boolean
  [k: string]: unknown
}

export interface EspnDraftPick {
  id: number
  overallPickNumber: number
  roundId: number
  roundPickNumber: number
  teamId: number
  playerId: number
  keeper?: boolean
  reservedForKeeper?: boolean
  autoDraftTypeId?: number
  memberId?: string
  [k: string]: unknown
}

export interface EspnLeague {
  id: number
  seasonId: number
  gameId?: number
  scoringPeriodId?: number
  settings?: {
    name?: string
    size?: number
    scoringSettings?: { scoringType?: string; scoringItems?: EspnScoringItem[]; [k: string]: unknown }
    scheduleSettings?: {
      matchupPeriodCount?: number
      playoffTeamCount?: number
      matchupPeriods?: Record<string, number[]>
      divisions?: { id: number; name: string; size?: number }[]
      [k: string]: unknown
    }
    draftSettings?: { keeperCount?: number; date?: number; [k: string]: unknown }
    [k: string]: unknown
  }
  status?: {
    currentMatchupPeriod?: number
    latestScoringPeriod?: number
    finalScoringPeriod?: number
    firstScoringPeriod?: number
    isActive?: boolean
    previousSeasons?: number[]
    [k: string]: unknown
  }
  members?: EspnMember[]
  teams?: EspnTeam[]
  schedule?: EspnMatchup[]
  draftDetail?: { picks?: EspnDraftPick[]; drafted?: boolean; [k: string]: unknown }
  [k: string]: unknown
}

/** One entry of kona_playercard `players[]`. */
export interface EspnPlayerCard {
  id: number
  onTeamId?: number
  player: EspnPlayer
  transactions?: EspnTransaction[]
  [k: string]: unknown
}

export interface EspnTransactionItem {
  type: string // ADD | DROP | TRADE | LINEUP | DRAFT
  playerId: number
  fromTeamId: number
  toTeamId: number
  isKeeper?: boolean
  overallPickNumber?: number
  [k: string]: unknown
}

export interface EspnTransaction {
  id: string
  type: string // FREEAGENT | WAIVER | ROSTER | TRADE_ACCEPT | DRAFT ...
  status: string
  proposedDate?: number
  processDate?: number
  executionType?: string
  teamId: number
  scoringPeriodId?: number
  items: EspnTransactionItem[]
  [k: string]: unknown
}

/** ESPN error envelope, e.g. on 401: { messages: ["You are not authorized ..."] } */
export interface EspnErrorBody {
  messages?: string[]
  details?: { message?: string; shortMessage?: string }[]
}

export function isEspnLeague(x: unknown): x is EspnLeague {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as EspnLeague).seasonId === 'number' &&
    Array.isArray((x as EspnLeague).teams)
  )
}
