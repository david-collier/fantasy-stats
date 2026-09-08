/**
 * Thin client for ESPN's undocumented fantasy API (baseball = game code "flb").
 *
 * Two endpoints return the same league shape:
 *   seasons/{year}/segments/0/leagues/{id}   — checks *your* membership that year
 *   leagueHistory/{id}?seasonId={year}        — checks *current* membership, returns [league]
 * Visibility differs per season and per endpoint (verified: 2021 is 401 on the
 * first and 200 on the second for this league), so we always fall through.
 *
 * Transaction history: the `kona_playercard` view returns, per player, every
 * league transaction involving them that season. Querying the top ~3000
 * players by ownership enumerates the whole season's history (verified 2025:
 * players beyond 3000 had zero transactions). It works for past seasons on
 * the seasons/ path; on the leagueHistory path it returns no transactions.
 */
import { setTimeout as sleep } from 'node:timers/promises'
import type { EspnAuth } from './auth.ts'
import { cookieHeader } from './auth.ts'
import {
  isEspnLeague,
  type EspnErrorBody,
  type EspnLeague,
  type EspnPlayer,
  type EspnPlayerCard,
} from '../src/types/espn.ts'

export const BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb'

/** All views we want in one request. Raw payload is preserved verbatim. */
export const LEAGUE_VIEWS = [
  'mSettings',
  'mTeam',
  'mRoster',
  'mMatchup',
  'mMatchupScore',
  'mStandings',
  'mDraftDetail',
  'mTransactions2',
] as const

export type Source = 'seasons' | 'leagueHistory'

export type FetchOutcome =
  | { ok: true; status: 200; source: Source; url: string; body: EspnLeague; bytes: number }
  | { ok: false; status: number; source: Source; url: string; error: string }

export type PlayerCardsOutcome =
  | { ok: true; status: 200; source: Source; players: EspnPlayerCard[]; bytes: number; requests: number }
  | { ok: false; status: number; source: Source; error: string }

interface RawResponse {
  status: number
  text: string
  body: unknown
}

function headers(auth: EspnAuth, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Cookie: cookieHeader(auth),
    Accept: 'application/json',
    // ESPN occasionally rejects bare/default user agents.
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    ...extra,
  }
}

const RETRY_DELAYS_MS = [1000, 3000, 9000]

/** GET + JSON parse with retries on 429/5xx/network only. 401/403/404 return immediately. */
async function getJson(url: string, h: Record<string, string>): Promise<RawResponse> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, { headers: h })
      const text = await res.text()
      let body: unknown
      try {
        body = text ? JSON.parse(text) : undefined
      } catch {
        body = undefined
      }
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt === RETRY_DELAYS_MS.length) {
        return { status: res.status, text, body }
      }
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err
      if (attempt === RETRY_DELAYS_MS.length) break
    }
    await sleep(RETRY_DELAYS_MS[attempt])
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function espnMessage(body: unknown, text: string): string {
  const b = body as EspnErrorBody | undefined
  const msg = b?.messages?.[0] ?? b?.details?.[0]?.shortMessage ?? b?.details?.[0]?.message
  return msg ?? text.slice(0, 200)
}

function fail(status: number, source: Source, url: string, error: string): FetchOutcome {
  return { ok: false, status, source, url, error }
}

function seasonUrl(auth: EspnAuth, season: number, query: string): string {
  return `${BASE}/seasons/${season}/segments/0/leagues/${auth.leagueId}?${query}`
}

function historyUrl(auth: EspnAuth, season: number, query: string): string {
  return `${BASE}/leagueHistory/${auth.leagueId}?seasonId=${season}&${query}`
}

export async function fetchLeagueSeason(auth: EspnAuth, season: number): Promise<FetchOutcome> {
  const query = LEAGUE_VIEWS.map((v) => `view=${v}`).join('&')
  const primaryUrl = seasonUrl(auth, season, query)

  let primary: RawResponse
  try {
    primary = await getJson(primaryUrl, headers(auth))
  } catch (err) {
    return fail(0, 'seasons', primaryUrl, `network: ${(err as Error).message}`)
  }
  if (primary.status === 200 && isEspnLeague(primary.body)) {
    return { ok: true, status: 200, source: 'seasons', url: primaryUrl, body: primary.body, bytes: primary.text.length }
  }
  const primaryMsg = espnMessage(primary.body, primary.text)

  // Fall through to leagueHistory on 401/404 (or a 200 with an unexpected shape).
  if (primary.status === 401 || primary.status === 404 || primary.status === 200) {
    const altUrl = historyUrl(auth, season, query)
    try {
      const alt = await getJson(altUrl, headers(auth))
      const body = Array.isArray(alt.body) ? alt.body[0] : alt.body
      if (alt.status === 200 && isEspnLeague(body)) {
        return { ok: true, status: 200, source: 'leagueHistory', url: altUrl, body, bytes: alt.text.length }
      }
      return fail(
        primary.status,
        'seasons',
        primaryUrl,
        `${primaryMsg} (leagueHistory also failed: ${alt.status} ${espnMessage(alt.body, alt.text)})`,
      )
    } catch (err) {
      return fail(primary.status, 'seasons', primaryUrl, `${primaryMsg} (leagueHistory network error: ${(err as Error).message})`)
    }
  }

  return fail(primary.status, 'seasons', primaryUrl, primaryMsg)
}

const PLAYERCARD_PAGE = 3000

/**
 * Player cards (with per-player transaction lists) for the top N players by
 * ownership. Two pages of 3000 cover every transacted player in practice.
 */
export async function fetchPlayerCards(auth: EspnAuth, season: number, source: Source): Promise<PlayerCardsOutcome> {
  const players: EspnPlayerCard[] = []
  let bytes = 0
  let requests = 0
  for (const offset of [0, PLAYERCARD_PAGE]) {
    const filter = JSON.stringify({
      players: { limit: PLAYERCARD_PAGE, offset, sortPercOwned: { sortPriority: 1, sortAsc: false } },
    })
    const url =
      source === 'seasons'
        ? seasonUrl(auth, season, 'view=kona_playercard')
        : historyUrl(auth, season, 'view=kona_playercard')
    let res: RawResponse
    try {
      res = await getJson(url, headers(auth, { 'x-fantasy-filter': filter }))
    } catch (err) {
      return { ok: false, status: 0, source, error: `network: ${(err as Error).message}` }
    }
    requests++
    bytes += res.text.length
    const body = Array.isArray(res.body) ? res.body[0] : res.body
    const page = (body as { players?: EspnPlayerCard[] } | undefined)?.players
    if (res.status !== 200 || !Array.isArray(page)) {
      return { ok: false, status: res.status, source, error: espnMessage(res.body, res.text) }
    }
    players.push(...page)
    if (page.length < PLAYERCARD_PAGE) break
  }
  return { ok: true, status: 200, source, players, bytes, requests }
}

/**
 * Resolve player names/positions by id from the season-wide player universe
 * (players_wl view). Used for drafted-then-dropped players that appear in no
 * roster or transaction archive. Batched to keep the filter header small.
 */
export async function fetchPlayerNames(auth: EspnAuth, season: number, ids: number[]): Promise<EspnPlayer[]> {
  const out: EspnPlayer[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const url = `${BASE}/seasons/${season}/players?scoringPeriodId=0&view=players_wl`
    const res = await getJson(url, headers(auth, { 'x-fantasy-filter': JSON.stringify({ filterIds: { value: batch } }) }))
    if (res.status === 200 && Array.isArray(res.body)) out.push(...(res.body as EspnPlayer[]))
  }
  return out
}
