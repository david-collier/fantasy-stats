/**
 * "My team" selection: a franchise id kept in localStorage so visitors see
 * their own rows highlighted everywhere. Franchise = team slot (stable across
 * seasons), so the highlight follows the slot through manager changes.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const KEY = 'fantasy-stats:my-franchise'

interface MyTeamContextValue {
  franchiseId: number | null
  setFranchiseId: (id: number | null) => void
}

const MyTeamContext = createContext<MyTeamContextValue>({ franchiseId: null, setFranchiseId: () => {} })

function read(): number | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v === null) return null
    const n = Number(v)
    return Number.isInteger(n) ? n : null
  } catch {
    return null
  }
}

export function MyTeamProvider({ children }: { children: ReactNode }) {
  const [franchiseId, setState] = useState<number | null>(read)
  const setFranchiseId = useCallback((id: number | null) => {
    setState(id)
    try {
      if (id === null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, String(id))
    } catch {
      // private mode etc. — selection just won't persist
    }
  }, [])
  const value = useMemo(() => ({ franchiseId, setFranchiseId }), [franchiseId, setFranchiseId])
  return <MyTeamContext.Provider value={value}>{children}</MyTeamContext.Provider>
}

export function useMyTeam(): MyTeamContextValue {
  return useContext(MyTeamContext)
}

/** CSS class for a row belonging to franchise `id`. */
export function mineClass(myId: number | null, id: number | undefined, extra?: string): string | undefined {
  const cls = [extra, myId !== null && id === myId ? 'mine' : undefined].filter(Boolean).join(' ')
  return cls || undefined
}
