/**
 * Data access for the UI. Season files are bundled at build time via
 * import.meta.glob (lazy: one hashed chunk per season), so there is no
 * runtime fetch and no base-path bookkeeping. index.json is tiny and eager.
 */
import { useEffect, useState } from 'react'
import type { SeasonData, SeasonIndex } from '../types/derived'
import indexJson from '../../data/derived/index.json'

const seasonModules = import.meta.glob<{ default: SeasonData }>('../../data/derived/[0-9]*.json')

export const seasonIndex = indexJson as unknown as SeasonIndex

export function listSeasons(): number[] {
  return Object.keys(seasonModules)
    .map((k) => Number(/(\d{4})\.json$/.exec(k)?.[1]))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => b - a)
}

export async function loadSeason(seasonId: number): Promise<SeasonData | undefined> {
  const loader = seasonModules[`../../data/derived/${seasonId}.json`]
  if (!loader) return undefined
  return (await loader()).default
}

export interface SeasonState {
  data?: SeasonData
  loading: boolean
  missing: boolean
}

export function useSeason(seasonId: number | undefined): SeasonState {
  const [state, setState] = useState<SeasonState>({ loading: seasonId !== undefined, missing: false })

  useEffect(() => {
    if (seasonId === undefined) {
      setState({ loading: false, missing: true })
      return
    }
    let cancelled = false
    setState({ loading: true, missing: false })
    loadSeason(seasonId).then((data) => {
      if (cancelled) return
      setState({ data, loading: false, missing: !data })
    })
    return () => {
      cancelled = true
    }
  }, [seasonId])

  return state
}
