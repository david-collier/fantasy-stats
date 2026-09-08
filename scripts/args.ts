import { parseArgs } from 'node:util'

export interface FetchArgs {
  /** Only this season. */
  season?: number
  /** Inclusive range override (defaults: config firstSeason .. current year). */
  from?: number
  to?: number
  /** Hit the API and derive, but write nothing. */
  check: boolean
  /** Also capture kona_player_info (large, changes every run). */
  players: boolean
  help: boolean
}

export function parseFetchArgs(argv: string[] = process.argv.slice(2)): FetchArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      season: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      check: { type: 'boolean', default: false },
      players: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false, short: 'h' },
    },
    strict: true,
  })
  const num = (v: string | undefined, name: string): number | undefined => {
    if (v === undefined) return undefined
    const n = Number(v)
    if (!Number.isInteger(n) || n < 2000 || n > 2100) {
      throw new Error(`--${name} must be a 4-digit year, got "${v}"`)
    }
    return n
  }
  return {
    season: num(values.season, 'season'),
    from: num(values.from, 'from'),
    to: num(values.to, 'to'),
    check: values.check ?? false,
    players: values.players ?? false,
    help: values.help ?? false,
  }
}

export const USAGE = `Usage: npm run fetch [-- options]

  --season YYYY   fetch one season only
  --from YYYY     first season (default: config firstSeason)
  --to YYYY       last season (default: current year)
  --check         dry run: fetch + derive, write nothing, same exit code
  --players       also capture kona_player_info (~10-30 MB, changes every run)
  -h, --help
`
