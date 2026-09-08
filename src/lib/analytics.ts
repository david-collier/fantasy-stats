/**
 * League analytics computed client-side from per-matchup category data.
 *
 * Definitions (documented on the Stats page):
 *  - Week = matchup period. Only completed regular-season weeks count unless noted.
 *  - Actual wins = category wins + 0.5 × ties.
 *  - xWins (expected wins) for a week = for each scored category, the share of the other
 *    11 teams the team would have beaten with that week's totals (ties count half), summed
 *    across categories. So a perfectly average week is 6.0 in a 12-category league.
 *  - Wins gained/lost = actual wins − xWins.
 *  - Strength of schedule = average weekly xWins of the opponents actually faced.
 *  - Power rating = Σ z-scores of season-to-date category totals (sign flipped for ERA/WHIP);
 *    Batting and Pitching are the sub-sums.
 *  - Net record = (category wins − losses) / 2, i.e. "games over .500".
 */
import type { Matchup, ScoringCategory, SeasonData, Team } from '../types/derived'

// ESPN stat ids used to rebuild rate stats from cumulative components.
const SID = { AB: 0, H: 1, DBL: 3, TPL: 4, HR: 5, SLG: 9, BB: 10, HBP: 12, SF: 13, OBP: 17, OUTS: 34, PH: 37, PBB: 39, WHIP: 41, ER: 45, ERA: 47 }

/** Recompute a rate stat from cumulative component totals; undefined if not a known rate. */
export function rateFromComponents(statId: number, v: Record<string, number>): number | undefined {
  const g = (id: number) => v[String(id)] ?? 0
  switch (statId) {
    case SID.OBP: {
      const den = g(SID.AB) + g(SID.BB) + g(SID.HBP) + g(SID.SF)
      return den ? (g(SID.H) + g(SID.BB) + g(SID.HBP)) / den : 0
    }
    case SID.SLG: {
      const ab = g(SID.AB)
      const tb = g(SID.H) + g(SID.DBL) + 2 * g(SID.TPL) + 3 * g(SID.HR)
      return ab ? tb / ab : 0
    }
    case SID.ERA: {
      const ip = g(SID.OUTS) / 3
      return ip ? (g(SID.ER) * 9) / ip : 0
    }
    case SID.WHIP: {
      const ip = g(SID.OUTS) / 3
      return ip ? (g(SID.PH) + g(SID.PBB)) / ip : 0
    }
    default:
      return undefined
  }
}

export const RATE_STAT_IDS = new Set([SID.OBP, SID.SLG, SID.ERA, SID.WHIP])

export interface WeekTeam {
  period: number
  teamId: number
  opponentId: number | null
  isPlayoff: boolean
  /** statId -> value for the week (includes components). */
  values: Record<string, number>
  catWins: number
  catLosses: number
  catTies: number
}

/** Flatten matchups into one row per team-week. Byes and matchups without stats are skipped. */
export function weekTeams(season: SeasonData, opts: { includePlayoffs?: boolean; completedOnly?: boolean } = {}): WeekTeam[] {
  const { includePlayoffs = false, completedOnly = true } = opts
  const lastComplete = season.status.isComplete ? Infinity : season.status.currentMatchupPeriod - 1
  const out: WeekTeam[] = []
  const ids = season.league.statIds
  for (const m of season.matchups) {
    if (!m.away || !m.home.stats || !m.away.stats) continue
    if (!includePlayoffs && m.isPlayoff) continue
    if (completedOnly && m.matchupPeriodId > lastComplete) continue
    for (const [side, opp] of [
      [m.home, m.away],
      [m.away, m.home],
    ] as const) {
      const values: Record<string, number> = {}
      ids.forEach((id, i) => (values[String(id)] = side.stats![i]))
      out.push({
        period: m.matchupPeriodId,
        teamId: side.teamId,
        opponentId: opp.teamId,
        isPlayoff: m.isPlayoff,
        values,
        catWins: side.categoryRecord?.wins ?? 0,
        catLosses: side.categoryRecord?.losses ?? 0,
        catTies: side.categoryRecord?.ties ?? 0,
      })
    }
  }
  return out
}

export function periodsOf(rows: WeekTeam[]): number[] {
  return [...new Set(rows.map((r) => r.period))].sort((a, b) => a - b)
}

/** Compare two category values: 1 if a beats b, 0.5 tie, 0 loss. */
export function beats(a: number, b: number, cat: ScoringCategory): number {
  if (a === b) return 0.5
  return (cat.isReverse ? a < b : a > b) ? 1 : 0
}

export interface WeekX {
  period: number
  teamId: number
  opponentId: number | null
  xWins: number
  actualWins: number
  /** per category: share of league beaten (0..1) */
  catShare: Record<string, number>
}

/** Expected wins per team-week. */
export function expectedWins(season: SeasonData, rows: WeekTeam[]): WeekX[] {
  const cats = season.league.categories
  const byPeriod = new Map<number, WeekTeam[]>()
  for (const r of rows) byPeriod.set(r.period, [...(byPeriod.get(r.period) ?? []), r])
  const out: WeekX[] = []
  for (const [period, teams] of byPeriod) {
    for (const t of teams) {
      const others = teams.filter((o) => o.teamId !== t.teamId)
      if (!others.length) continue
      let x = 0
      const catShare: Record<string, number> = {}
      for (const c of cats) {
        const key = String(c.statId)
        const mine = t.values[key] ?? 0
        let s = 0
        for (const o of others) s += beats(mine, o.values[key] ?? 0, c)
        const share = s / others.length
        catShare[key] = share
        x += share
      }
      out.push({ period, teamId: t.teamId, opponentId: t.opponentId, xWins: x, actualWins: t.catWins + 0.5 * t.catTies, catShare })
    }
  }
  return out
}

export interface TeamSeasonX {
  teamId: number
  weeks: number
  xWins: number
  actualWins: number
  gained: number
  sos: number
}

export function seasonExpected(x: WeekX[]): TeamSeasonX[] {
  const byTeam = new Map<number, WeekX[]>()
  for (const w of x) byTeam.set(w.teamId, [...(byTeam.get(w.teamId) ?? []), w])
  const lookup = new Map(x.map((w) => [`${w.period}:${w.teamId}`, w]))
  return [...byTeam.entries()].map(([teamId, ws]) => {
    const xWins = ws.reduce((a, w) => a + w.xWins, 0)
    const actualWins = ws.reduce((a, w) => a + w.actualWins, 0)
    const oppX = ws.map((w) => (w.opponentId !== null ? lookup.get(`${w.period}:${w.opponentId}`)?.xWins : undefined)).filter((v): v is number => v !== undefined)
    return {
      teamId,
      weeks: ws.length,
      xWins,
      actualWins,
      gained: actualWins - xWins,
      sos: oppX.length ? oppX.reduce((a, b) => a + b, 0) / oppX.length : 0,
    }
  })
}

/** Cumulative season-to-date totals per team after each week (rates rebuilt from components). */
export function cumulativeTotals(season: SeasonData, rows: WeekTeam[]): Map<number, Map<number, Record<string, number>>> {
  // period -> teamId -> totals
  const out = new Map<number, Map<number, Record<string, number>>>()
  const running = new Map<number, Record<string, number>>()
  for (const period of periodsOf(rows)) {
    const snap = new Map<number, Record<string, number>>()
    for (const r of rows.filter((r) => r.period === period)) {
      const acc = { ...(running.get(r.teamId) ?? {}) }
      for (const [k, v] of Object.entries(r.values)) {
        if (RATE_STAT_IDS.has(Number(k))) continue
        acc[k] = (acc[k] ?? 0) + v
      }
      for (const id of RATE_STAT_IDS) acc[String(id)] = rateFromComponents(id, acc) ?? 0
      running.set(r.teamId, acc)
    }
    for (const [teamId, acc] of running) snap.set(teamId, { ...acc })
    out.set(period, snap)
    void season
  }
  return out
}

export interface PowerRating {
  teamId: number
  batting: number
  pitching: number
  total: number
  /** statId -> z */
  z: Record<string, number>
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

/** Power ratings from a set of team totals (season totals or a cumulative snapshot). */
export function powerRatings(cats: ScoringCategory[], totals: Map<number, Record<string, number>>): PowerRating[] {
  const teams = [...totals.keys()]
  const zByCat = new Map<string, Map<number, number>>()
  for (const c of cats) {
    const key = String(c.statId)
    const vals = teams.map((t) => totals.get(t)![key] ?? 0)
    const m = mean(vals)
    const sd = stdev(vals)
    const zs = new Map<number, number>()
    teams.forEach((t, i) => {
      let z = sd ? (vals[i] - m) / sd : 0
      if (c.isReverse) z = -z
      zs.set(t, z)
    })
    zByCat.set(key, zs)
  }
  return teams.map((teamId) => {
    let batting = 0
    let pitching = 0
    const z: Record<string, number> = {}
    for (const c of cats) {
      const v = zByCat.get(String(c.statId))!.get(teamId)!
      z[String(c.statId)] = v
      if (c.side === 'batting') batting += v
      else pitching += v
    }
    return { teamId, batting, pitching, total: batting + pitching, z }
  })
}

/** Season totals per team straight from ESPN's valuesByStat. */
export function seasonTotals(season: SeasonData): Map<number, Record<string, number>> {
  return new Map(season.teams.map((t) => [t.id, t.statTotals]))
}

/** 1 = best, per category, from totals. */
export function categoryRanks(cats: ScoringCategory[], totals: Map<number, Record<string, number>>): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>()
  for (const t of totals.keys()) out.set(t, {})
  for (const c of cats) {
    const key = String(c.statId)
    const sorted = [...totals.entries()].sort((a, b) => {
      const av = a[1][key] ?? 0
      const bv = b[1][key] ?? 0
      return c.isReverse ? av - bv : bv - av
    })
    sorted.forEach(([teamId], i) => (out.get(teamId)![key] = i + 1))
  }
  return out
}

/** Games over .500 after each week, per team. */
export function netRecordSeries(rows: WeekTeam[]): Map<number, { period: number; net: number }[]> {
  const out = new Map<number, { period: number; net: number }[]>()
  const running = new Map<number, number>()
  for (const period of periodsOf(rows)) {
    for (const r of rows.filter((r) => r.period === period)) {
      const n = (running.get(r.teamId) ?? 0) + (r.catWins - r.catLosses) / 2
      running.set(r.teamId, n)
      out.set(r.teamId, [...(out.get(r.teamId) ?? []), { period, net: n }])
    }
  }
  return out
}

export interface MatchupAnalysis {
  matchup: Matchup
  period: number
  home: { teamId: number; xWins: number; catWins: number; differential: number }
  away: { teamId: number; xWins: number; catWins: number; differential: number }
  /** Categories decided by a thin margin (≤ 10% of that week's league spread); ties included. */
  closeCategories: number
  closeList: string[]
}

/** Per-matchup view for one week: xWins each side, z-differential, close categories. */
export function analyzeWeek(season: SeasonData, rows: WeekTeam[], x: WeekX[], period: number): MatchupAnalysis[] {
  const cats = season.league.categories
  const weekRows = rows.filter((r) => r.period === period)
  const sd = new Map<string, number>()
  for (const c of cats) sd.set(String(c.statId), stdev(weekRows.map((r) => r.values[String(c.statId)] ?? 0)))
  const xl = new Map(x.filter((w) => w.period === period).map((w) => [w.teamId, w]))
  const out: MatchupAnalysis[] = []
  for (const m of season.matchups) {
    if (m.matchupPeriodId !== period || !m.away || !m.home.stats || !m.away.stats) continue
    const awaySide = m.away
    const hv = weekRows.find((r) => r.teamId === m.home.teamId)?.values ?? {}
    const av = weekRows.find((r) => r.teamId === awaySide.teamId)?.values ?? {}
    let diff = 0
    let close = 0
    const closeList: string[] = []
    for (const c of cats) {
      const key = String(c.statId)
      const s = sd.get(key) || 1
      const d = ((hv[key] ?? 0) - (av[key] ?? 0)) / s
      diff += c.isReverse ? -d : d
      if (Math.abs(d) <= 0.1) {
        close++
        closeList.push(c.name)
      }
    }
    out.push({
      matchup: m,
      period,
      home: { teamId: m.home.teamId, xWins: xl.get(m.home.teamId)?.xWins ?? 0, catWins: m.home.categoryRecord?.wins ?? 0, differential: diff },
      away: { teamId: awaySide.teamId, xWins: xl.get(awaySide.teamId)?.xWins ?? 0, catWins: awaySide.categoryRecord?.wins ?? 0, differential: -diff },
      closeCategories: close,
      closeList,
    })
  }
  return out
}

export function teamMap(season: SeasonData): Map<number, Team> {
  return new Map(season.teams.map((t) => [t.id, t]))
}
