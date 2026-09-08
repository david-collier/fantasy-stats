/**
 * Raw ESPN league payload -> compact SeasonData the UI reads.
 * Defensive on purpose: the API is undocumented and older seasons differ.
 * Anything not mapped here is still available in data/raw/<season>/league.json.
 */
import type { EspnLeague, EspnMatchup, EspnTeam } from '../src/types/espn.ts'
import type {
  LeagueInfo,
  Matchup,
  MatchupSide,
  MatchupWinner,
  Member,
  ScoringCategory,
  SeasonData,
  SeasonIndex,
  SeasonIndexEntry,
  Team,
} from '../src/types/derived.ts'
import { STATS_MAP } from './constants.ts'

const POINTS_TYPES = new Set(['H2H_POINTS', 'TOTAL_SEASON_POINTS'])
const CATEGORY_TYPES = new Set(['H2H_CATEGORY', 'H2H_MOST_CATEGORIES', 'ROTO'])

export function teamDisplayName(t: EspnTeam): string {
  const name = t.name?.trim()
  if (name) return name
  return [t.location, t.nickname].filter(Boolean).join(' ').trim() || `Team ${t.id}`
}

export function memberDisplayName(m: Member | undefined, fallbackId: string): string {
  if (!m) return fallbackId
  const real = [m.firstName, m.lastName].filter(Boolean).join(' ').trim()
  return real || m.displayName || fallbackId
}

function deriveCategories(raw: EspnLeague): ScoringCategory[] {
  const items = raw.settings?.scoringSettings?.scoringItems ?? []
  return items.map((i) => ({
    statId: i.statId,
    name: STATS_MAP[i.statId] ?? `stat_${i.statId}`,
    isReverse: Boolean(i.isReverseItem),
  }))
}

function deriveLeague(raw: EspnLeague): LeagueInfo {
  const scoringType = raw.settings?.scoringSettings?.scoringType ?? 'UNKNOWN'
  return {
    id: raw.id,
    name: raw.settings?.name?.trim() || `League ${raw.id}`,
    size: raw.settings?.size ?? raw.teams?.length ?? 0,
    scoringType,
    isPointsBased: POINTS_TYPES.has(scoringType),
    isCategoryBased: CATEGORY_TYPES.has(scoringType),
    regularSeasonMatchupCount: raw.settings?.scheduleSettings?.matchupPeriodCount ?? 0,
    playoffTeamCount: raw.settings?.scheduleSettings?.playoffTeamCount ?? 0,
    categories: deriveCategories(raw),
    matchupPeriodLengths: raw.settings?.scheduleSettings?.matchupPeriods,
  }
}

function deriveTeam(t: EspnTeam, membersById: Map<string, Member>): Team {
  const overall = t.record?.overall
  const ownerIds = t.owners ?? (t.primaryOwner ? [t.primaryOwner] : [])
  return {
    id: t.id,
    abbrev: t.abbrev,
    name: teamDisplayName(t),
    logo: t.logo || undefined,
    divisionId: t.divisionId,
    primaryOwnerId: t.primaryOwner,
    ownerIds,
    ownerNames: ownerIds.map((id) => memberDisplayName(membersById.get(id), id)),
    record: {
      wins: overall?.wins ?? 0,
      losses: overall?.losses ?? 0,
      ties: overall?.ties ?? 0,
      percentage: overall?.percentage ?? 0,
      pointsFor: overall?.pointsFor ?? 0,
      pointsAgainst: overall?.pointsAgainst ?? 0,
      gamesBack: overall?.gamesBack,
    },
    playoffSeed: t.playoffSeed ?? 0,
    finalRank: t.rankCalculatedFinal ?? 0,
    currentProjectedRank: t.currentProjectedRank,
  }
}

function deriveSide(s: EspnMatchup['home']): MatchupSide {
  const side: MatchupSide = { teamId: s.teamId, totalPoints: s.totalPoints ?? 0 }
  if (s.cumulativeScore) {
    side.categoryRecord = {
      wins: s.cumulativeScore.wins ?? 0,
      losses: s.cumulativeScore.losses ?? 0,
      ties: s.cumulativeScore.ties ?? 0,
    }
  }
  return side
}

function deriveWinner(w: string | undefined): MatchupWinner {
  if (w === 'HOME' || w === 'AWAY' || w === 'TIE') return w
  return 'UNDECIDED'
}

function deriveMatchup(m: EspnMatchup, regularSeasonMatchupCount: number): Matchup {
  const playoffTierType = m.playoffTierType ?? 'NONE'
  return {
    id: m.id,
    matchupPeriodId: m.matchupPeriodId,
    playoffTierType,
    isPlayoff: playoffTierType !== 'NONE' || (regularSeasonMatchupCount > 0 && m.matchupPeriodId > regularSeasonMatchupCount),
    winner: deriveWinner(m.winner),
    home: deriveSide(m.home),
    away: m.away ? deriveSide(m.away) : null,
  }
}

export function deriveSeason(raw: EspnLeague, fetchedAt: string): SeasonData {
  const members: Member[] = (raw.members ?? []).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    firstName: m.firstName || undefined,
    lastName: m.lastName || undefined,
  }))
  const membersById = new Map(members.map((m) => [m.id, m]))

  const league = deriveLeague(raw)
  const teams = (raw.teams ?? []).map((t) => deriveTeam(t, membersById))
  const matchups = (raw.schedule ?? []).map((m) => deriveMatchup(m, league.regularSeasonMatchupCount))

  const st = raw.status ?? {}
  const latest = st.latestScoringPeriod ?? raw.scoringPeriodId ?? 0
  const final = st.finalScoringPeriod ?? 0
  const isActive = st.isActive ?? false
  const isComplete = !isActive || (final > 0 && latest >= final)

  const champion = isComplete ? teams.find((t) => t.finalRank === 1) : undefined

  return {
    schemaVersion: 1,
    seasonId: raw.seasonId,
    fetchedAt,
    league,
    status: {
      currentMatchupPeriod: st.currentMatchupPeriod ?? 0,
      latestScoringPeriod: latest,
      finalScoringPeriod: final,
      firstScoringPeriod: st.firstScoringPeriod ?? 1,
      isActive,
      isComplete,
      previousSeasons: st.previousSeasons ?? [],
    },
    members,
    teams,
    matchups,
    championTeamId: champion?.id ?? null,
  }
}

export interface IndexInput {
  leagueId: number
  currentSeason: number
  lastUpdated: string
  entries: SeasonIndexEntry[]
  /** Newest successfully derived season, for the league name. */
  newest?: SeasonData
}

export function buildIndex(input: IndexInput): SeasonIndex {
  return {
    leagueId: input.leagueId,
    leagueName: input.newest?.league.name ?? `League ${input.leagueId}`,
    lastUpdated: input.lastUpdated,
    currentSeason: input.currentSeason,
    seasons: [...input.entries].sort((a, b) => b.seasonId - a.seasonId),
  }
}

export function indexEntryFromSeason(s: SeasonData, isCurrent: boolean): SeasonIndexEntry {
  const champ = s.championTeamId != null ? s.teams.find((t) => t.id === s.championTeamId) : undefined
  return {
    seasonId: s.seasonId,
    status: 'ok',
    httpStatus: 200,
    isCurrent,
    isComplete: s.status.isComplete,
    championTeamId: s.championTeamId,
    championName: champ?.name ?? null,
  }
}
