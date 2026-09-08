/**
 * Cross-season pass. Runs after every season has been derived and reads the
 * derived files from disk, so it also covers seasons skipped by --season.
 *
 *  - data/derived/league.json   franchise (team slot) history across seasons
 *  - data/derived/players.json  global player directory
 *  - keeperSince / originType   patched into each season's roster entries
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Franchise,
  FranchiseSeason,
  LeagueSummary,
  PlayerDirectory,
  PlayerRef,
  SeasonData,
  SeasonTransactions,
} from '../src/types/derived.ts'
import { readJsonIfExists, writeJsonIfChanged } from './io.ts'

export interface CrossSeasonResult {
  changed: boolean
  seasons: number[]
  franchises: number
  players: number
}

export function listDerivedSeasons(dir: string): number[] {
  try {
    return readdirSync(dir)
      .map((f) => /^(\d{4})\.json$/.exec(f)?.[1])
      .filter((s): s is string => Boolean(s))
      .map(Number)
      .sort((a, b) => a - b)
  } catch {
    return []
  }
}

/**
 * For each keeper on a season's roster, walk back through prior seasons while
 * the player stayed on the same franchise's final roster. keeperSince = first
 * season of that run; originType = how they joined in that season.
 */
function patchKeeperOrigins(seasons: Map<number, SeasonData>): Set<number> {
  const touched = new Set<number>()
  const years = [...seasons.keys()].sort((a, b) => a - b)
  for (const year of years) {
    const s = seasons.get(year)!
    for (const [teamId, roster] of Object.entries(s.rosters)) {
      for (const entry of roster) {
        if (!entry.keeper) continue
        let since = year
        let originType = entry.acquisitionType
        let y = year - 1
        let prev = seasons.get(y)
        while (prev) {
          const prevEntry = prev.rosters[teamId]?.find((e) => e.playerId === entry.playerId)
          if (!prevEntry) break
          since = y
          originType = prevEntry.acquisitionType
          if (!prevEntry.keeper) break
          y -= 1
          prev = seasons.get(y)
        }
        // A keeper must have been on the roster the prior year even if that
        // season's data is missing; never claim the keeper season itself.
        if (since === year) {
          since = year - 1
          originType = 'UNKNOWN'
        }
        if (entry.keeperSince !== since || entry.originType !== originType) {
          entry.keeperSince = since
          entry.originType = originType
          touched.add(year)
        }
      }
    }
  }
  return touched
}

function buildFranchises(seasons: Map<number, SeasonData>): Franchise[] {
  const byId = new Map<number, FranchiseSeason[]>()
  for (const s of seasons.values()) {
    const divName = new Map(s.league.divisions.map((d) => [d.id, d.name]))
    for (const t of s.teams) {
      const list = byId.get(t.franchiseId) ?? []
      list.push({
        seasonId: s.seasonId,
        teamId: t.id,
        teamName: t.name,
        abbrev: t.abbrev,
        managerId: t.primaryOwnerId,
        managerName: t.managerName,
        managerShort: t.managerShort,
        ownerNames: t.ownerNames,
        divisionId: t.divisionId,
        divisionName: t.divisionId !== undefined ? divName.get(t.divisionId) : undefined,
        record: t.record,
        playoffSeed: t.playoffSeed,
        finalRank: t.finalRank,
        isComplete: s.status.isComplete,
        champion: s.championTeamId === t.id,
        madePlayoffs: t.playoffSeed > 0 && t.playoffSeed <= s.league.playoffTeamCount,
      })
      byId.set(t.franchiseId, list)
    }
  }
  return [...byId.entries()]
    .map(([id, list]) => {
      list.sort((a, b) => a.seasonId - b.seasonId)
      const latest = list[list.length - 1]
      return { id, managerName: latest.managerName, managerShort: latest.managerShort, teamName: latest.teamName, seasons: list }
    })
    .sort((a, b) => a.id - b.id)
}

function mergePlayers(target: PlayerDirectory, source: Record<string, PlayerRef>): void {
  for (const [id, p] of Object.entries(source)) {
    const { stats: _stats, ...rest } = p // per-season stats stay in season files
    void _stats
    target[id] = { ...target[id], ...rest }
  }
}

/** Player ids referenced by drafts, rosters or transactions that have no entry in the directory. */
export function missingPlayerIds(derivedDir: string, players: PlayerDirectory): number[] {
  const missing = new Set<number>()
  for (const y of listDerivedSeasons(derivedDir)) {
    const s = readJsonIfExists<SeasonData>(join(derivedDir, `${y}.json`))
    if (!s) continue
    for (const p of s.draft) if (!players[String(p.playerId)]) missing.add(p.playerId)
    for (const r of Object.values(s.rosters)) for (const e of r) if (!players[String(e.playerId)]) missing.add(e.playerId)
    const tx = readJsonIfExists<SeasonTransactions>(join(derivedDir, `${y}-tx.json`))
    for (const t of tx?.transactions ?? []) for (const i of t.items) if (!players[String(i.playerId)]) missing.add(i.playerId)
  }
  return [...missing].sort((a, b) => a - b)
}

export function runCrossSeason(derivedDir: string, leagueId: number, currentSeason: number, extraPlayers: PlayerDirectory = {}): CrossSeasonResult {
  const years = listDerivedSeasons(derivedDir)
  const seasons = new Map<number, SeasonData>()
  for (const y of years) {
    const s = readJsonIfExists<SeasonData>(join(derivedDir, `${y}.json`))
    if (s) seasons.set(y, s)
  }

  let changed = false
  for (const y of patchKeeperOrigins(seasons)) {
    changed = writeJsonIfChanged(join(derivedDir, `${y}.json`), seasons.get(y)) || changed
  }

  const franchises = buildFranchises(seasons)
  const newest = [...seasons.values()].sort((a, b) => b.seasonId - a.seasonId)[0]
  const summary: LeagueSummary = {
    leagueId,
    leagueName: newest?.league.name ?? `League ${leagueId}`,
    seasons: [...seasons.keys()].sort((a, b) => b - a),
    currentSeason,
    franchises,
  }
  changed = writeJsonIfChanged(join(derivedDir, 'league.json'), summary) || changed

  const players: PlayerDirectory = { ...extraPlayers }
  for (const y of [...seasons.keys()].sort((a, b) => a - b)) {
    mergePlayers(players, seasons.get(y)!.players)
    const tx = readJsonIfExists<SeasonTransactions>(join(derivedDir, `${y}-tx.json`))
    if (tx) mergePlayers(players, tx.players)
  }
  changed = writeJsonIfChanged(join(derivedDir, 'players.json'), players) || changed

  return { changed, seasons: years, franchises: franchises.length, players: Object.keys(players).length }
}
