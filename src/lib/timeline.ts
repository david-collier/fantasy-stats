/**
 * A player's life in the league: drafts, keeps, adds, drops, trades across seasons.
 * Built from season draft picks + roster keeper flags + transaction archives.
 */
import type { SeasonData, SeasonTransactions, Transaction } from '../types/derived'

export type TimelineKind = 'DRAFT' | 'KEEPER' | 'ADD' | 'WAIVER' | 'DROP' | 'TRADE'

export interface TimelineEvent {
  kind: TimelineKind
  seasonId: number
  date: number // epoch ms (draft events use the draft date)
  teamId: number // team receiving (or dropping) the player
  fromTeamId?: number // trades
  detail?: string // e.g. "Round 3, pick 28"
  /** Full transaction for trades (to render the trade tree). */
  transaction?: Transaction
  keeperSince?: number
}

export function buildTimeline(playerId: number, seasons: SeasonData[], txs: SeasonTransactions[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const txBySeason = new Map(txs.map((t) => [t.seasonId, t]))

  for (const s of seasons) {
    const draftDate = s.league.draftDate ?? Date.UTC(s.seasonId, 2, 15)
    for (const p of s.draft) {
      if (p.playerId !== playerId) continue
      const entry = s.rosters[String(p.teamId)]?.find((e) => e.playerId === playerId)
      events.push({
        kind: p.keeper ? 'KEEPER' : 'DRAFT',
        seasonId: s.seasonId,
        date: draftDate + p.overall, // keep draft order stable when sorting
        teamId: p.teamId,
        detail: p.keeper ? `Kept (round ${p.round} slot)` : `Round ${p.round}, pick ${p.overall}`,
        keeperSince: p.keeper ? entry?.keeperSince : undefined,
      })
    }
    const tx = txBySeason.get(s.seasonId)
    if (tx) {
      for (const t of tx.transactions) {
        const mine = t.items.filter((i) => i.playerId === playerId)
        if (!mine.length) continue
        if (t.type === 'TRADE_ACCEPT') {
          const it = mine[0]
          events.push({ kind: 'TRADE', seasonId: s.seasonId, date: t.date, teamId: it.toTeamId, fromTeamId: it.fromTeamId, transaction: t })
          continue
        }
        for (const it of mine) {
          if (it.type === 'ADD') {
            events.push({ kind: t.type === 'WAIVER' ? 'WAIVER' : 'ADD', seasonId: s.seasonId, date: t.date, teamId: it.toTeamId, transaction: t })
          } else if (it.type === 'DROP') {
            events.push({ kind: 'DROP', seasonId: s.seasonId, date: t.date, teamId: it.fromTeamId, transaction: t })
          }
        }
      }
    } else if (!s.hasTransactions) {
      // No archive: synthesize the acquisition from the final roster where it wasn't the draft.
      for (const [teamId, roster] of Object.entries(s.rosters)) {
        const e = roster.find((r) => r.playerId === playerId)
        if (!e || e.acquisitionType === 'DRAFT' || e.acquisitionType === 'UNKNOWN') continue
        events.push({
          kind: e.acquisitionType === 'TRADE' ? 'TRADE' : 'ADD',
          seasonId: s.seasonId,
          date: e.acquisitionDate ?? Date.UTC(s.seasonId, 6, 1),
          teamId: Number(teamId),
          detail: 'from end-of-season roster (no transaction log for this season)',
        })
      }
    }
  }
  events.sort((a, b) => a.date - b.date)
  return events
}

/** All trades in a season, newest first. */
export function trades(tx: SeasonTransactions | undefined): Transaction[] {
  return (tx?.transactions ?? []).filter((t) => t.type === 'TRADE_ACCEPT').sort((a, b) => b.date - a.date)
}

/** Group trade items by receiving team: teamId -> playerIds received. */
export function tradeSides(t: Transaction): Map<number, number[]> {
  const m = new Map<number, number[]>()
  for (const i of t.items) {
    if (i.type !== 'TRADE') continue
    m.set(i.toTeamId, [...(m.get(i.toTeamId) ?? []), i.playerId])
  }
  return m
}
