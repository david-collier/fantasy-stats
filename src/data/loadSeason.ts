/**
 * Data access for the UI. Season files are bundled at build time via
 * import.meta.glob (lazy: one hashed chunk per season), so there is no
 * runtime fetch and no base-path bookkeeping. Small files are eager.
 */
import { useEffect, useState } from 'react'
import type { LeagueSummary, PlayerDirectory, SeasonData, SeasonIndex, SeasonTransactions } from '../types/derived'
import indexJson from '../../data/derived/index.json'
import leagueJson from '../../data/derived/league.json'

const seasonModules = import.meta.glob<{ default: SeasonData }>('../../data/derived/[0-9][0-9][0-9][0-9].json')
const txModules = import.meta.glob<{ default: SeasonTransactions }>('../../data/derived/[0-9][0-9][0-9][0-9]-tx.json')

export const seasonIndex = indexJson as unknown as SeasonIndex
export const leagueSummary = leagueJson as unknown as LeagueSummary

export function listSeasons(): number[] {
  return Object.keys(seasonModules)
    .map((k) => Number(/(\d{4})\.json$/.exec(k)?.[1]))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => b - a)
}

const seasonCache = new Map<number, Promise<SeasonData | undefined>>()
const txCache = new Map<number, Promise<SeasonTransactions | undefined>>()
let playersCache: Promise<PlayerDirectory> | undefined

export function loadSeason(seasonId: number): Promise<SeasonData | undefined> {
  let p = seasonCache.get(seasonId)
  if (!p) {
    const loader = seasonModules[`../../data/derived/${seasonId}.json`]
    p = loader ? loader().then((m) => m.default) : Promise.resolve(undefined)
    seasonCache.set(seasonId, p)
  }
  return p
}

export function loadSeasonTx(seasonId: number): Promise<SeasonTransactions | undefined> {
  let p = txCache.get(seasonId)
  if (!p) {
    const loader = txModules[`../../data/derived/${seasonId}-tx.json`]
    p = loader ? loader().then((m) => m.default) : Promise.resolve(undefined)
    txCache.set(seasonId, p)
  }
  return p
}

export function loadPlayers(): Promise<PlayerDirectory> {
  playersCache ??= import('../../data/derived/players.json').then((m) => m.default as unknown as PlayerDirectory)
  return playersCache
}

export async function loadAllSeasons(): Promise<SeasonData[]> {
  const all = await Promise.all(listSeasons().map((y) => loadSeason(y)))
  return all.filter((s): s is SeasonData => Boolean(s)).sort((a, b) => a.seasonId - b.seasonId)
}

export async function loadAllTx(): Promise<SeasonTransactions[]> {
  const all = await Promise.all(listSeasons().map((y) => loadSeasonTx(y)))
  return all.filter((s): s is SeasonTransactions => Boolean(s)).sort((a, b) => a.seasonId - b.seasonId)
}

// ---- hooks ---------------------------------------------------------------

interface AsyncState<T> {
  data?: T
  loading: boolean
  missing: boolean
}

function useAsync<T>(key: string, load: () => Promise<T | undefined>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, missing: false })
  useEffect(() => {
    let cancelled = false
    setState({ loading: true, missing: false })
    load().then((data) => {
      if (cancelled) return
      setState({ data, loading: false, missing: data === undefined })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

export function useSeason(seasonId: number | undefined): AsyncState<SeasonData> {
  return useAsync(`season:${seasonId}`, () => (seasonId === undefined ? Promise.resolve(undefined) : loadSeason(seasonId)))
}

export function useSeasonTx(seasonId: number | undefined): AsyncState<SeasonTransactions> {
  return useAsync(`tx:${seasonId}`, () => (seasonId === undefined ? Promise.resolve(undefined) : loadSeasonTx(seasonId)))
}

export function useAllSeasons(): AsyncState<SeasonData[]> {
  return useAsync('all-seasons', loadAllSeasons)
}

export function useAllTx(): AsyncState<SeasonTransactions[]> {
  return useAsync('all-tx', loadAllTx)
}

export function usePlayers(): AsyncState<PlayerDirectory> {
  return useAsync('players', loadPlayers)
}
