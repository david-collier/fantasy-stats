/**
 * Raw ESPN league payload -> compact SeasonData / SeasonTransactions the UI reads.
 * Defensive on purpose: the API is undocumented and older seasons differ.
 * Anything not mapped here is still available in data/raw/<season>/league.json.
 */
import type {
  EspnDraftPick,
  EspnLeague,
  EspnMatchup,
  EspnMatchupSide,
  EspnPlayer,
  EspnRosterEntry,
  EspnTeam,
  EspnTransaction,
} from '../src/types/espn.ts'
import type {
  CatResult,
  DraftPick,
  LeagueInfo,
  Matchup,
  MatchupSide,
  MatchupWinner,
  Member,
  PlayerRef,
  RosterEntry,
  ScoringCategory,
  SeasonData,
  SeasonIndex,
  SeasonIndexEntry,
  SeasonTransactions,
  Team,
  Transaction,
} from '../src/types/derived.ts'
import { STATS_MAP } from './constants.ts'

const POINTS_TYPES = new Set(['H2H_POINTS', 'TOTAL_SEASON_POINTS'])
const CATEGORY_TYPES = new Set(['H2H_CATEGORY', 'H2H_MOST_CATEGORIES', 'ROTO'])
/** ESPN baseball stat ids: 0–31 batting, 32+ pitching. */
const FIRST_PITCHING_STAT_ID = 32

export function teamDisplayName(t: EspnTeam): string {
  const name = t.name?.trim()
  if (name) return name
  return [t.location, t.nickname].filter(Boolean).join(' ').trim() || `Team ${t.id}`
}

export function memberFullName(m: Member | undefined, fallbackId: string): string {
  if (!m) return fallbackId
  const real = [m.firstName, m.lastName].filter(Boolean).join(' ').trim()
  return real || m.displayName || fallbackId
}

function memberFirstName(m: Member | undefined, fallback: string): string {
  return m?.firstName?.trim() || m?.displayName || fallback
}

function deriveCategories(raw: EspnLeague): ScoringCategory[] {
  const items = raw.settings?.scoringSettings?.scoringItems ?? []
  return items.map((i) => ({
    statId: i.statId,
    name: STATS_MAP[i.statId] ?? `stat_${i.statId}`,
    isReverse: Boolean(i.isReverseItem),
    side: i.statId < FIRST_PITCHING_STAT_ID ? 'batting' : 'pitching',
  }))
}

function collectStatIds(raw: EspnLeague): number[] {
  const ids = new Set<number>()
  for (const m of raw.schedule ?? []) {
    for (const side of [m.home, m.away]) {
      for (const k of Object.keys(side?.cumulativeScore?.scoreByStat ?? {})) ids.add(Number(k))
    }
  }
  return [...ids].sort((a, b) => a - b)
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
    divisions: (raw.settings?.scheduleSettings?.divisions ?? []).map((d) => ({ id: d.id, name: d.name })),
    statIds: collectStatIds(raw),
    matchupPeriodLengths: raw.settings?.scheduleSettings?.matchupPeriods,
    keeperCount: raw.settings?.draftSettings?.keeperCount,
    draftDate: raw.settings?.draftSettings?.date,
  }
}

function deriveTeam(t: EspnTeam, membersById: Map<string, Member>, shortNames: Map<number, string>): Team {
  const overall = t.record?.overall
  const div = t.record?.division
  const ownerIds = t.owners ?? (t.primaryOwner ? [t.primaryOwner] : [])
  const ownerNames = ownerIds.map((id) => memberFullName(membersById.get(id), id))
  const primary = t.primaryOwner ?? ownerIds[0]
  return {
    id: t.id,
    franchiseId: t.id,
    abbrev: t.abbrev,
    name: teamDisplayName(t),
    logo: t.logo || undefined,
    divisionId: t.divisionId,
    primaryOwnerId: primary,
    ownerIds,
    ownerNames,
    managerName: ownerNames.join(' & ') || `Team ${t.id}`,
    managerShort: shortNames.get(t.id) ?? memberFirstName(membersById.get(primary ?? ''), t.abbrev),
    record: {
      wins: overall?.wins ?? 0,
      losses: overall?.losses ?? 0,
      ties: overall?.ties ?? 0,
      percentage: overall?.percentage ?? 0,
      pointsFor: overall?.pointsFor ?? 0,
      pointsAgainst: overall?.pointsAgainst ?? 0,
      gamesBack: overall?.gamesBack,
    },
    divisionRecord: div ? { wins: div.wins ?? 0, losses: div.losses ?? 0, ties: div.ties ?? 0 } : undefined,
    playoffSeed: t.playoffSeed ?? 0,
    finalRank: t.rankCalculatedFinal ?? 0,
    currentProjectedRank: t.currentProjectedRank,
    statTotals: t.valuesByStat ?? {},
  }
}

/** Primary owner's first name, disambiguated with a last initial when two teams share it. */
function buildShortNames(teams: EspnTeam[], membersById: Map<string, Member>): Map<number, string> {
  const first = new Map<number, { short: string; full: string }>()
  for (const t of teams) {
    const m = membersById.get(t.primaryOwner ?? t.owners?.[0] ?? '')
    const short = memberFirstName(m, t.abbrev)
    const last = m?.lastName?.trim()
    first.set(t.id, { short, full: last ? `${short} ${last[0]}.` : short })
  }
  const counts = new Map<string, number>()
  for (const v of first.values()) counts.set(v.short, (counts.get(v.short) ?? 0) + 1)
  const out = new Map<number, string>()
  for (const [id, v] of first) out.set(id, (counts.get(v.short) ?? 0) > 1 ? v.full : v.short)
  return out
}

function deriveSide(s: EspnMatchupSide, statIds: number[]): MatchupSide {
  const side: MatchupSide = { teamId: s.teamId, totalPoints: s.totalPoints ?? 0 }
  const cs = s.cumulativeScore
  if (cs) {
    side.categoryRecord = { wins: cs.wins ?? 0, losses: cs.losses ?? 0, ties: cs.ties ?? 0 }
    if (cs.scoreByStat && statIds.length) {
      side.stats = statIds.map((id) => cs.scoreByStat![String(id)]?.score ?? 0)
      side.results = statIds.map((id): CatResult => {
        const r = cs.scoreByStat![String(id)]?.result
        return r === 'WIN' ? 'W' : r === 'LOSS' ? 'L' : r === 'TIE' ? 'T' : null
      })
    }
  }
  return side
}

function deriveWinner(w: string | undefined): MatchupWinner {
  if (w === 'HOME' || w === 'AWAY' || w === 'TIE') return w
  return 'UNDECIDED'
}

function deriveMatchup(m: EspnMatchup, regularSeasonMatchupCount: number, statIds: number[]): Matchup {
  const playoffTierType = m.playoffTierType ?? 'NONE'
  return {
    id: m.id,
    matchupPeriodId: m.matchupPeriodId,
    playoffTierType,
    isPlayoff:
      playoffTierType !== 'NONE' || (regularSeasonMatchupCount > 0 && m.matchupPeriodId > regularSeasonMatchupCount),
    winner: deriveWinner(m.winner),
    home: deriveSide(m.home, statIds),
    away: m.away ? deriveSide(m.away, statIds) : null,
  }
}

export function playerRef(p: EspnPlayer, seasonId?: number): PlayerRef {
  const ref: PlayerRef = {
    id: p.id,
    name: p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || `Player ${p.id}`,
    positionId: p.defaultPositionId,
    proTeamId: p.proTeamId,
    eligibleSlots: p.eligibleSlots,
  }
  if (seasonId !== undefined) {
    const season = (p.stats ?? []).find(
      (s) => s.statSourceId === 0 && s.statSplitTypeId === 0 && s.seasonId === seasonId,
    )
    if (season?.stats) ref.stats = season.stats
  }
  return ref
}

function deriveDraft(picks: EspnDraftPick[]): DraftPick[] {
  return picks
    .map((p) => ({
      overall: p.overallPickNumber,
      round: p.roundId,
      pick: p.roundPickNumber,
      teamId: p.teamId,
      playerId: p.playerId,
      keeper: Boolean(p.keeper),
      autoDraft: Boolean(p.autoDraftTypeId),
    }))
    .sort((a, b) => a.overall - b.overall)
}

function deriveRoster(
  teamId: number,
  entries: EspnRosterEntry[],
  picksByTeamPlayer: Map<string, DraftPick>,
): RosterEntry[] {
  return entries.map((e) => {
    const pick = picksByTeamPlayer.get(`${teamId}:${e.playerId}`)
    // Older seasons (2021 via leagueHistory) omit acquisitionType; infer DRAFT from the pick list.
    const acquisitionType = e.acquisitionType ?? (pick ? 'DRAFT' : 'UNKNOWN')
    const entry: RosterEntry = {
      playerId: e.playerId,
      lineupSlotId: e.lineupSlotId,
      acquisitionType,
      acquisitionDate: e.acquisitionDate ?? null,
      injuryStatus: e.injuryStatus,
      keeper: Boolean(pick?.keeper && acquisitionType === 'DRAFT'),
    }
    if (pick) entry.draft = { round: pick.round, pick: pick.pick, overall: pick.overall }
    return entry
  })
}

export function deriveSeason(raw: EspnLeague, fetchedAt: string, hasTransactions: boolean): SeasonData {
  const members: Member[] = (raw.members ?? []).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    firstName: m.firstName || undefined,
    lastName: m.lastName || undefined,
  }))
  const membersById = new Map(members.map((m) => [m.id, m]))
  const rawTeams = raw.teams ?? []
  const shortNames = buildShortNames(rawTeams, membersById)

  const league = deriveLeague(raw)
  const teams = rawTeams.map((t) => deriveTeam(t, membersById, shortNames))
  const matchups = (raw.schedule ?? []).map((m) => deriveMatchup(m, league.regularSeasonMatchupCount, league.statIds))

  const draft = deriveDraft(raw.draftDetail?.picks ?? [])
  const picksByTeamPlayer = new Map(draft.map((p) => [`${p.teamId}:${p.playerId}`, p]))

  const rosters: Record<string, RosterEntry[]> = {}
  const players: Record<string, PlayerRef> = {}
  for (const t of rawTeams) {
    const entries = t.roster?.entries ?? []
    rosters[String(t.id)] = deriveRoster(t.id, entries, picksByTeamPlayer)
    for (const e of entries) {
      if (e.playerPoolEntry?.player) players[String(e.playerId)] = playerRef(e.playerPoolEntry.player, raw.seasonId)
    }
  }

  const st = raw.status ?? {}
  const latest = st.latestScoringPeriod ?? raw.scoringPeriodId ?? 0
  const final = st.finalScoringPeriod ?? 0
  const isActive = st.isActive ?? false
  const isComplete = !isActive || (final > 0 && latest >= final)
  const champion = isComplete ? teams.find((t) => t.finalRank === 1) : undefined

  return {
    schemaVersion: 2,
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
    rosters,
    draft,
    players,
    hasTransactions,
  }
}

/** Raw transactions (deduped, from kona_playercard) -> SeasonTransactions. */
export function deriveTransactions(
  seasonId: number,
  raw: EspnTransaction[],
  players: Record<string, PlayerRef>,
  source: 'playercard' | 'none',
): SeasonTransactions {
  const transactions: Transaction[] = []
  for (const t of raw) {
    if (t.type === 'DRAFT') continue // drafts come from draftDetail, uniformly across seasons
    if (t.status && t.status !== 'EXECUTED') continue
    const items = (t.items ?? [])
      .filter((i) => i.type !== 'LINEUP')
      .map((i) => ({
        type: i.type,
        playerId: i.playerId,
        fromTeamId: i.fromTeamId,
        toTeamId: i.toTeamId,
        keeper: i.isKeeper || undefined,
        overallPick: i.overallPickNumber || undefined,
      }))
    if (!items.length) continue
    transactions.push({
      id: t.id,
      type: t.type,
      status: t.status,
      date: t.processDate ?? t.proposedDate ?? 0,
      teamId: t.teamId,
      scoringPeriodId: t.scoringPeriodId ?? 0,
      items,
    })
  }
  transactions.sort((a, b) => a.date - b.date)
  return { seasonId, source, transactions, players }
}

export interface IndexInput {
  leagueId: number
  currentSeason: number
  lastUpdated: string
  entries: SeasonIndexEntry[]
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
  const podium = s.status.isComplete
    ? [1, 2, 3].map((r) => s.teams.find((t) => t.finalRank === r)?.id).filter((x): x is number => x !== undefined)
    : undefined
  return {
    seasonId: s.seasonId,
    status: 'ok',
    httpStatus: 200,
    isCurrent,
    isComplete: s.status.isComplete,
    championTeamId: s.championTeamId,
    championName: champ?.name ?? null,
    championManager: champ?.managerName ?? null,
    podium,
    hasTransactions: s.hasTransactions,
  }
}
