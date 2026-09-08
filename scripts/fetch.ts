/**
 * CLI: pull every season of the league from ESPN, write raw + derived JSON.
 *
 *   npm run fetch                 all seasons (config firstSeason..current year, plus any
 *                                 extra years ESPN lists in status.previousSeasons)
 *   npm run fetch -- --season 2024
 *   npm run fetch -- --check      dry run, writes nothing, same exit code
 *   npm run fetch -- --tx         re-capture transaction history for completed seasons too
 *   npm run fetch -- --players    also capture kona_player_info
 *
 * Exit code is the cookie-expiry alarm: a failure on the current season (or a
 * 401 on last season) exits 1 so the GitHub Actions run goes red and emails.
 * Failures on older seasons are warnings only.
 */
import { join } from 'node:path'
import { parseFetchArgs, USAGE } from './args.ts'
import { loadAuth } from './auth.ts'
import { listDerivedSeasons, missingPlayerIds, runCrossSeason } from './crossSeason.ts'
import { buildIndex, deriveSeason, deriveTransactions, indexEntryFromSeason, playerRef } from './derive.ts'
import { fetchLeagueSeason, fetchPlayerCards, fetchPlayerNames, type FetchOutcome, type Source } from './espn.ts'
import { formatBytes, readJsonIfExists, writeJsonIfChanged } from './io.ts'
import type { EspnTransaction } from '../src/types/espn.ts'
import type { PlayerDirectory, PlayerRef, SeasonData, SeasonFetchStatus, SeasonIndex, SeasonIndexEntry } from '../src/types/derived.ts'

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

/** data/raw/<season>/transactions.json — deduped player-card transactions, trimmed player refs. */
interface RawTransactions {
  fetchedAt: string
  source: 'playercard' | 'none'
  note?: string
  playersScanned: number
  transactions: EspnTransaction[]
  players: Record<string, PlayerRef>
}

interface SeasonResult {
  season: number
  outcome: FetchOutcome
  derived?: SeasonData
  changed: boolean
  txNote?: string
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
    if (outcome.status === 404 && month <= 2) return false // league not renewed yet
    return true
  }
  if (season === currentYear - 1 && statusLabel(outcome.status) === 'unauthorized') return true
  return false
}

async function captureTransactions(
  season: number,
  auth: ReturnType<typeof loadAuth>,
  source: Source,
  isComplete: boolean,
  opts: { check: boolean; tx: boolean },
): Promise<{ raw: RawTransactions; changed: boolean; note: string }> {
  const rawPath = join(RAW_DIR, String(season), 'transactions.json')
  const existing = readJsonIfExists<RawTransactions>(rawPath)

  // Completed seasons never change: reuse the archive unless --tx forces a refresh.
  if (existing && isComplete && !opts.tx) {
    return { raw: existing, changed: false, note: `tx: ${existing.transactions.length} (archived)` }
  }

  const cards = await fetchPlayerCards(auth, season, source)
  if (!cards.ok) {
    if (existing) return { raw: existing, changed: false, note: `tx: fetch failed (${cards.status}), kept archive` }
    const raw: RawTransactions = {
      fetchedAt: new Date().toISOString(),
      source: 'none',
      note: `playercard fetch failed: ${cards.status} ${cards.error}`,
      playersScanned: 0,
      transactions: [],
      players: {},
    }
    return { raw, changed: false, note: `tx: unavailable (${cards.status})` }
  }

  const byId = new Map<string, EspnTransaction>()
  const players: Record<string, PlayerRef> = {}
  for (const card of cards.players) {
    if (!card.transactions?.length) continue
    players[String(card.id)] = playerRef(card.player)
    for (const t of card.transactions) byId.set(t.id, t)
  }
  const transactions = [...byId.values()].sort((a, b) => (a.processDate ?? a.proposedDate ?? 0) - (b.processDate ?? b.proposedDate ?? 0))
  const source2: RawTransactions['source'] = transactions.length ? 'playercard' : 'none'
  const raw: RawTransactions = {
    fetchedAt: existing?.fetchedAt ?? new Date().toISOString(),
    source: source2,
    note: source2 === 'none' ? 'ESPN returned no transactions for this season (leagueHistory path has none)' : undefined,
    playersScanned: cards.players.length,
    transactions,
    players,
  }
  // Only bump fetchedAt when the content actually changed.
  const same =
    existing &&
    JSON.stringify({ ...existing, fetchedAt: '' }) === JSON.stringify({ ...raw, fetchedAt: '' })
  if (!same) raw.fetchedAt = new Date().toISOString()
  const changed = opts.check ? !same : writeJsonIfChanged(rawPath, raw)
  return {
    raw,
    changed,
    note: `tx: ${transactions.length} from ${cards.players.length} cards (${formatBytes(cards.bytes)}${changed ? ', changed' : ''})`,
  }
}

async function processSeason(
  season: number,
  auth: ReturnType<typeof loadAuth>,
  opts: { check: boolean; players: boolean; tx: boolean },
): Promise<SeasonResult> {
  const outcome = await fetchLeagueSeason(auth, season)
  if (!outcome.ok) return { season, outcome, changed: false }

  const dir = join(RAW_DIR, String(season))
  const rawPath = join(dir, 'league.json')
  const metaPath = join(dir, '_meta.json')
  const derivedPath = join(DERIVED_DIR, `${season}.json`)
  const txDerivedPath = join(DERIVED_DIR, `${season}-tx.json`)

  const prevMeta = readJsonIfExists<RawMeta>(metaPath)
  const now = new Date().toISOString()

  let changed = false
  let fetchedAt = prevMeta?.fetchedAt ?? now
  if (opts.check) {
    const prevRaw = readJsonIfExists<unknown>(rawPath)
    changed = JSON.stringify(prevRaw) !== JSON.stringify(outcome.body)
    if (changed) fetchedAt = now
  } else {
    changed = writeJsonIfChanged(rawPath, outcome.body)
    if (changed || !prevMeta) fetchedAt = now
    const meta: RawMeta = { source: outcome.source, status: 200, url: outcome.url, fetchedAt }
    writeJsonIfChanged(metaPath, meta)
  }

  // Provisional derive to learn completeness, then transactions, then final derive.
  const provisional = deriveSeason(outcome.body, fetchedAt, false)
  const tx = await captureTransactions(season, auth, outcome.source, provisional.status.isComplete, opts)
  changed = changed || tx.changed

  const derived = deriveSeason(outcome.body, fetchedAt, tx.raw.source === 'playercard')
  const derivedTx = deriveTransactions(season, tx.raw.transactions, tx.raw.players, tx.raw.source)
  if (!opts.check) {
    // Preserve keeperSince/originType from the previous derive; crossSeason recomputes them anyway.
    const prevDerived = readJsonIfExists<SeasonData>(derivedPath)
    if (prevDerived?.rosters) {
      for (const [teamId, roster] of Object.entries(derived.rosters)) {
        for (const e of roster) {
          const p = prevDerived.rosters[teamId]?.find((x) => x.playerId === e.playerId)
          if (p?.keeperSince) {
            e.keeperSince = p.keeperSince
            e.originType = p.originType
          }
        }
      }
    }
    changed = writeJsonIfChanged(derivedPath, derived) || changed
    changed = writeJsonIfChanged(txDerivedPath, derivedTx) || changed
  }

  if (opts.players) {
    console.warn(`  ${season}: --players (kona_player_info) is not implemented in v2; skipping`)
  }

  return { season, outcome, derived, changed, txNote: tx.note }
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
    `${args.check ? '[check] ' : ''}league ${auth.leagueId} · seasons ${from}–${to}${args.tx ? ' · refresh tx archives' : ''}`,
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
      const champ = d.championTeamId != null ? d.teams.find((t) => t.id === d.championTeamId) : undefined
      const state = d.status.isComplete
        ? `complete${champ ? ` · champion: ${champ.managerShort} (${champ.name})` : ''}`
        : `live · matchup ${d.status.currentMatchupPeriod}`
      console.log(
        `${season}    200     ${o.source.padEnd(13)}  ${formatBytes(o.bytes).padStart(7)}  ${r.changed ? 'changed  ' : 'unchanged'} · ${d.teams.length} teams · ${state}`,
      )
      if (r.txNote) console.log(`${''.padEnd(48)}${r.txNote}`)
      anyChanged ||= r.changed
    } else {
      const f = isFatal(season, o, currentYear)
      fatal ||= f
      console.log(`${season}    ${String(o.status).padEnd(7)} ${o.source.padEnd(13)}        -  ${f ? 'FATAL' : 'skipped'} · ${o.error}`)
    }
  }

  // ---- Cross-season + index ----------------------------------------------
  if (!args.check) {
    // Names for players who appear only as draft picks (drafted, then dropped before season end).
    const extraPath = join(RAW_DIR, 'players-extra.json')
    const extra = readJsonIfExists<PlayerDirectory>(extraPath) ?? {}
    let x = runCrossSeason(DERIVED_DIR, auth.leagueId, currentYear, extra)
    const missing = missingPlayerIds(DERIVED_DIR, readJsonIfExists<PlayerDirectory>(join(DERIVED_DIR, 'players.json')) ?? {})
    if (missing.length) {
      const found = await fetchPlayerNames(auth, currentYear, missing)
      for (const p of found) extra[String(p.id)] = playerRef(p)
      for (const id of missing) extra[String(id)] ??= { id, name: `Player #${id}`, positionId: -1, proTeamId: 0 }
      writeJsonIfChanged(extraPath, extra)
      x = runCrossSeason(DERIVED_DIR, auth.leagueId, currentYear, extra)
      console.log(`
resolved ${found.length}/${missing.length} missing player names`)
    }
    anyChanged ||= x.changed
    console.log('')
    console.log(`cross-season: ${x.seasons.length} seasons · ${x.franchises} franchises · ${x.players} players${x.changed ? ' · changed' : ''}`)
  }

  const indexPath = join(DERIVED_DIR, 'index.json')
  const prevIndex = readJsonIfExists<SeasonIndex>(indexPath)
  const entries = new Map<number, SeasonIndexEntry>()
  for (const y of listDerivedSeasons(DERIVED_DIR)) {
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
    console.log(`index.json ${idxChanged ? 'updated' : 'unchanged'} · league: ${index.leagueName}`)
  } else {
    console.log('')
    console.log(`[check] nothing written · league: ${index.leagueName}`)
  }

  if (fatal) {
    console.error(
      '\nFATAL: current-season fetch failed. If the status is 401, the espn_s2 cookie has probably expired: ' +
        're-copy it from your browser and update .env / the ESPN_S2 repository secret.',
    )
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
