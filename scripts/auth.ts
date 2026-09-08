/**
 * ESPN private-league auth. Two cookies from a logged-in browser session:
 *   espn_s2 — long URL-encoded session token (keep it exactly as copied)
 *   SWID    — account GUID in braces, e.g. {BBECCE3D-....}
 *
 * Locally they come from .env (git-ignored). In GitHub Actions they arrive as
 * environment variables from repository secrets. Existing env vars always win
 * over .env, so CI is never affected by a stray local file.
 */

export const DEFAULT_LEAGUE_ID = 1295435853

export interface EspnAuth {
  espnS2: string
  swid: string
  leagueId: number
}

const SWID_RE = /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/i

export function loadAuth(): EspnAuth {
  try {
    process.loadEnvFile('.env')
  } catch {
    // No .env — fine in CI; rely on process.env.
  }

  const espnS2 = process.env.ESPN_S2?.trim()
  let swid = process.env.ESPN_SWID?.trim()
  const leagueId = Number(process.env.ESPN_LEAGUE_ID ?? DEFAULT_LEAGUE_ID)

  if (!espnS2 || !swid) {
    throw new Error(
      'Missing ESPN_S2 and/or ESPN_SWID. Locally: copy .env.example to .env and fill it in. ' +
        'In GitHub Actions: add them as repository secrets.',
    )
  }
  if (!swid.startsWith('{')) swid = `{${swid}}`
  if (!SWID_RE.test(swid)) {
    throw new Error(`ESPN_SWID does not look like a GUID in braces: ${swid}`)
  }
  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    throw new Error(`ESPN_LEAGUE_ID is not a positive integer: ${process.env.ESPN_LEAGUE_ID}`)
  }

  return { espnS2, swid, leagueId }
}

export function cookieHeader(auth: EspnAuth): string {
  return `espn_s2=${auth.espnS2}; SWID=${auth.swid}`
}
