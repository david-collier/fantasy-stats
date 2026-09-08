/**
 * Minimal typing of the raw ESPN fantasy API payload: only the fields
 * scripts/derive.ts touches. Everything else is preserved verbatim in
 * data/raw/<season>/league.json via the index signature.
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
  record?: { overall?: EspnRecordSplit }
  playoffSeed?: number
  rankCalculatedFinal?: number
  currentProjectedRank?: number
  [k: string]: unknown
}

export interface EspnMatchupSide {
  teamId: number
  totalPoints?: number
  cumulativeScore?: { wins: number; losses: number; ties: number; statBySlot?: unknown }
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
      [k: string]: unknown
    }
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
