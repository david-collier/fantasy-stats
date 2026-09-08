/**
 * CLI: pull every season of the league from ESPN, write raw + derived JSON.
 *
 *   npm run fetch                 all seasons (config firstSeason..current year, plus any
 *                                 extra years ESPN lists in status.previousSeasons)
 *   npm run fetch -- --season 2024
 *   npm run fetch -- --check      dry run, writes nothing, same exit code
 *   npm run fetch -- --players    also capture kona_player_info
 *
 * Exit code is the cookie-expiry alarm: a failure on the current season (or a
 * 401 on last season) exits 1 so the GitHub Actions run goes red and emails.
 * Failures on older seasons are warnings only.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFetchArgs, USAGE } from './args.ts'
import { loadAuth } from './auth.ts'
import { buildIndex, deriveSeason, indexEntryFromSeason } from './derive.ts'
import { fetchLeagueSeason, fetchPlayers, type FetchOutcome, type Source } from './espn.ts'
import { formatBytes, readJsonIfExists, writeJsonIfChanged } from './io.ts'
import type { SeasonData, SeasonFetchStatus, SeasonIndex, SeasonIndexEntry } from '../src/types/derived.ts'

const CONFIG_PATH = 'config/league.json'
const RAW_DIR = 'data/raw'
const DERIVED_DIR = 'data/derived'

interface LeagueConfig {
  leagueId: number
  firstSeason: number
}

interface RawMeta {
  source: Source
  status: number
  url: string
  fetchedAt: string
}

interface SeasonResult {
  season: number
  outcome: FetchOutcome
  derived?: SeasonData
  changed: boolean
  playersChanged?: boolean
}

function statusLabel(status: number): SeasonFetchStatus {
  if (status === 200) return 'ok'
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'not_found'
  return 'error'
}

/** Which failures should fail the run (see header comment). */
function isFatal(season: number, outcome: FetchOutcome, currentYear: number): boolean {
  if (outcome.ok) return false
  const month = new Date().getMonth() // 0 = Jan
  if (season === currentYear) {
    // Jan–Mar: the league may simply not be renewed yet.
    if (outcome.status === 404 && month <= 2) return false
    return true
  }
  if (season === currentYear - 1 && statusLabel(outcome.status) === 'unauthorized') return true
  return false
}

function existingDerivedSeasons(): number[] {
  try {
    return readdirSync(DERIVED_DIR)
      .map((f) => /^(\d{4})\.json$/.exec(f)?.[1])
      .filter((s): s is string => Boolean(s))
      .map(Number)
  } catch {
    return []
  }
}

async function processSeason(
  season: number,
  auth: ReturnType<typeof loadAuth>,
  opts: { check: boolean; players: boolean },
): Promise<SeasonResult> {
  const outcome = await fetchLeagueSeason(auth, season)
  if (!outcome.ok) return { season, outcome, changed: false }

  const rawPath = join(RAW_DIR, String(season), 'league.json')
  const metaPath = join(RAW_DIR, String(season), '_meta.json')
  const derivedPath = join(DERIVED_DIR, `${season}.json`)

  const prevMeta = readJsonIfExists<RawMeta>(metaPath)
  const now = new Date().toISOString()

  let changed = false
  let fetchedAt = prevMeta?.fetchedAt ?? now
  if (opts.check) {
    // Compare without writing so --check can still report "would change".
    const prevRaw = readJsonIfExists<unknown>(rawPath)
    changed = JSON.stringify(prevRaw) !== JSON.stringify(outcome.body)
    if (changed) fetchedAt = now
  } else {
    changed = writeJsonIfChanged(rawPath, outcome.body)
    if (changed || !prevMeta) fetchedAt = now
    const meta: RawMeta = { source: outcome.source, status: 200, url: outcome.url, fetchedAt }
    writeJsonIfChanged(metaPath, meta)
  }

  const derived = deriveSeason(outcome.body, fetchedAt)
  if (!opts.check) {
    changed = writeJsonIfChanged(derivedPath, derived) || changed
  }

  let playersChanged: boolean | undefined
  if (opts.players) {
    const p = await fetchPlayers(auth, season, derived.status.latestScoringPeriod)
    if (p.ok) {
      playersChanged = opts.check ? undefined : writeJsonIfChanged(join(RAW_DIR, String(season), 'players.json'), p.body)
      changed = changed || Boolean(playersChanged)
    } else {
      console.warn(`  ${season} players: ${p.status} ${p.error}`)
    }
  }

  return { season, outcome, derived, changed, playersChanged }
}

async function main(): Promise<number> {
  const args = parseFetchArgs()
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const config = readJsonIfExists<LeagueConfig>(CONFIG_PATH) ?? { leagueId: 1295435853, firstSeason: 2021 }
  process.env.ESPN_LEAGUE_ID ??= String(config.leagueId)
  const auth = loadAuth()

  const currentYear = new Date().getFullYear()
  const from = args.season ?? args.from ?? config.firstSeason
  const to = args.season ?? args.to ?? currentYear
  if (from > to) throw new Error(`--from ${from} is after --to ${to}`)

  const seasons = new Set<number>()
  for (let y = from; y <= to; y++) seasons.add(y)

  console.log(
    `${args.check ? '[check] ' : ''}league ${auth.leagueId} · seasons ${from}–${to}${args.players ? ' · +players' : ''}`,
  )

  const results = new Map<number, SeasonResult>()

  // Current year first: fails fast on bad cookies and discovers previousSeasons.
  if (seasons.has(currentYear)) {
    const r = await processSeason(currentYear, auth, args)
    results.set(currentYear, r)
    if (r.derived && !args.season) {
      for (const y of r.derived.status.previousSeasons) {
        if (y >= (args.from ?? config.firstSeason) && y <= to) seasons.add(y)
      }
    }
  }

  const ordered = [...seasons].sort((a, b) => b - a)
  for (const season of ordered) {
    if (results.has(season)) continue
    results.set(season, await processSeason(season, auth, args))
  }

  // ---- Report -------------------------------------------------------------
  let fatal = false
  let anyChanged = false
  console.log('')
  console.log('season  status  source         size     result')
  for (const season of ordered) {
    const r = results.get(season)!
    const o = r.outcome
    if (o.ok) {
      const d = r.derived!
      const champ = d.championTeamId != null ? d.teams.find((t) => t.id === d.championTeamId)?.name : undefined
      const state = d.status.isComplete ? `complete${champ ? ` · champion: ${champ}` : ''}` : `live · matchup ${d.status.currentMatchupPeriod}`
      const players = r.playersChanged === undefined ? '' : r.playersChanged ? ' · players changed' : ' · players unchanged'
      console.log(
        `${season}    200     ${o.source.padEnd(13)}  ${formatBytes(o.bytes).padStart(7)}  ${r.changed ? 'changed  ' : 'unchanged'} · ${d.teams.length} teams · ${state}${players}`,
      )
      anyChanged ||= r.changed
    } else {
      const f = isFatal(season, o, currentYear)
      fatal ||= f
      console.log(`${season}    ${String(o.status).padEnd(7)} ${o.source.padEnd(13)}        -  ${f ? 'FATAL' : 'skipped'} · ${o.error}`)
    }
  }

  // ---- Index --------------------------------------------------------------
  const indexPath = join(DERIVED_DIR, 'index.json')
  const prevIndex = readJsonIfExists<SeasonIndex>(indexPath)
  const entries = new Map<number, SeasonIndexEntry>()

  // Seasons already on disk from earlier runs (e.g. when --season narrowed this run).
  for (const y of existingDerivedSeasons()) {
    const d = readJsonIfExists<SeasonData>(join(DERIVED_DIR, `${y}.json`))
    if (d) entries.set(y, indexEntryFromSeason(d, y === currentYear))
  }
  let newest: SeasonData | undefined
  for (const [season, r] of results) {
    if (r.derived) {
      entries.set(season, indexEntryFromSeason(r.derived, season === currentYear))
      if (!newest || r.derived.seasonId > newest.seasonId) newest = r.derived
    } else if (!entries.has(season)) {
      entries.set(season, {
        seasonId: season,
        status: statusLabel(r.outcome.status),
        httpStatus: r.outcome.status,
        isCurrent: season === currentYear,
      })
    }
  }
  if (!newest) {
    const years = [...entries.keys()].filter((y) => entries.get(y)!.status === 'ok').sort((a, b) => b - a)
    if (years[0]) newest = readJsonIfExists<SeasonData>(join(DERIVED_DIR, `${years[0]}.json`))
  }

  const index = buildIndex({
    leagueId: auth.leagueId,
    currentSeason: currentYear,
    lastUpdated: anyChanged || !prevIndex ? new Date().toISOString() : prevIndex.lastUpdated,
    entries: [...entries.values()],
    newest,
  })
  if (!args.check) {
    const idxChanged = writeJsonIfChanged(indexPath, index)
    console.log('')
    console.log(`index.json ${idxChanged ? 'updated' : 'unchanged'} · league: ${index.leagueName}`)
  } else {
    console.log('')
    console.log(`[check] nothing written · league: ${index.leagueName}`)
  }

  if (fatal) {
    console.error('\nFATAL: current-season fetch failed. If the status is 401, the espn_s2 cookie has probably expired: ' +
      're-copy it from your browser and update .env / the ESPN_S2 repository secret.')
    return 1
  }
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
