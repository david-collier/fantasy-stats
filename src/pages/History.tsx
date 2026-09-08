import { Link } from 'react-router-dom'
import { leagueSummary, useAllSeasons } from '../data/loadSeason'
import { useMyTeam, mineClass } from '../data/myTeam'
import ManagerLabel from '../components/ManagerLabel'
import Heatmap from '../components/Heatmap'
import { ordinal, pct, pctString } from '../lib/format'
import type { Franchise, SeasonData } from '../types/derived'

export default function History() {
  const { franchiseId: mine } = useMyTeam()
  const all = useAllSeasons()
  const seasons = [...leagueSummary.seasons].sort((a, b) => b - a)
  const franchises = leagueSummary.franchises

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>League History</h2>
          <p className="muted">{seasons.length} seasons · franchise = team slot, credited across manager changes</p>
        </div>
      </div>

      <h3>Seasons</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Season</th>
            <th>Champion</th>
            <th>Runner-up</th>
            <th>Third</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((y) => {
            const finishers = [1, 2, 3].map((r) => franchises.map((f) => f.seasons.find((s) => s.seasonId === y && s.finalRank === r && s.isComplete)).find(Boolean))
            const live = !franchises.some((f) => f.seasons.find((s) => s.seasonId === y)?.isComplete)
            return (
              <tr key={y}>
                <td>
                  <Link to={`/season/${y}`}>
                    <b>{y}</b>
                  </Link>
                </td>
                {live ? (
                  <td colSpan={3} className="muted">
                    In progress
                  </td>
                ) : (
                  finishers.map((fs, i) => (
                    <td key={i} className={mineClass(mine, franchises.find((f) => f.seasons.includes(fs!))?.id)}>
                      {fs ? <ManagerLabel franchiseId={franchises.find((f) => f.seasons.includes(fs))!.id} managerName={fs.managerName} teamName={fs.teamName} /> : '—'}
                    </td>
                  ))
                )}
                <td className="links">
                  <Link to={`/season/${y}`}>Detail</Link>
                  <Link to={`/standings/${y}`}>Standings</Link>
                  <Link to={`/matchups/${y}`}>Matchups</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3>All-time standings</h3>
      <AllTime franchises={franchises} seasons={all.data} mine={mine} />

      <h3>Results by season</h3>
      <p className="muted small">Final finish per franchise. 1 = champion. Regular-season seed in the tooltip.</p>
      <ResultsGrid franchises={franchises} seasons={seasons} mine={mine} />
    </section>
  )
}

function AllTime({ franchises, seasons, mine }: { franchises: Franchise[]; seasons?: SeasonData[]; mine: number | null }) {
  const matchupRecord = new Map<number, { w: number; l: number; t: number; pw: number; pl: number }>()
  for (const s of seasons ?? []) {
    const lastComplete = s.status.isComplete ? Infinity : s.status.currentMatchupPeriod - 1
    for (const m of s.matchups) {
      if (!m.away || m.matchupPeriodId > lastComplete || m.winner === 'UNDECIDED') continue
      for (const [side, won] of [
        [m.home, m.winner === 'HOME'],
        [m.away, m.winner === 'AWAY'],
      ] as const) {
        const r = matchupRecord.get(side.teamId) ?? { w: 0, l: 0, t: 0, pw: 0, pl: 0 }
        if (m.winner === 'TIE') r.t++
        else if (won) r.w++
        else r.l++
        if (m.playoffTierType === 'WINNERS_BRACKET') {
          if (won) r.pw++
          else if (m.winner !== 'TIE') r.pl++
        }
        matchupRecord.set(side.teamId, r)
      }
    }
  }
  const rows = franchises
    .map((f) => {
      const done = f.seasons.filter((s) => s.isComplete)
      const w = f.seasons.reduce((a, s) => a + s.record.wins, 0)
      const l = f.seasons.reduce((a, s) => a + s.record.losses, 0)
      const t = f.seasons.reduce((a, s) => a + s.record.ties, 0)
      const finishes = done.map((s) => s.finalRank).filter((r) => r > 0)
      return {
        f,
        w,
        l,
        t,
        pct: pct(w, l, t),
        titles: done.filter((s) => s.champion).length,
        playoffs: done.filter((s) => s.madePlayoffs).length,
        avgFinish: finishes.length ? finishes.reduce((a, b) => a + b, 0) / finishes.length : 0,
        best: finishes.length ? Math.min(...finishes) : 0,
        m: matchupRecord.get(f.id),
      }
    })
    .sort((a, b) => b.pct - a.pct)
  return (
    <table className="data">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>Franchise</th>
          <th className="num">Seasons</th>
          <th className="num">Cat W-L-T</th>
          <th className="num">Pct</th>
          <th className="num">Matchups</th>
          <th className="num">Playoff W-L</th>
          <th className="num">Playoffs</th>
          <th className="num">Titles</th>
          <th className="num">Avg finish</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.f.id} className={mineClass(mine, r.f.id)}>
            <td className="num">{i + 1}</td>
            <td>
              <ManagerLabel franchiseId={r.f.id} managerName={r.f.managerName} teamName={managersOf(r.f)} />
            </td>
            <td className="num">{r.f.seasons.length}</td>
            <td className="num">
              {r.w}-{r.l}-{r.t}
            </td>
            <td className="num">{pctString(r.pct)}</td>
            <td className="num">{r.m ? `${r.m.w}-${r.m.l}${r.m.t ? `-${r.m.t}` : ''}` : '…'}</td>
            <td className="num">{r.m ? `${r.m.pw}-${r.m.pl}` : '…'}</td>
            <td className="num">{r.playoffs}</td>
            <td className="num">{r.titles ? '🏆'.repeat(r.titles) : '—'}</td>
            <td className="num">{r.avgFinish ? r.avgFinish.toFixed(1) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** "Also: Doug (2021)" style note for slots with earlier managers. */
function managersOf(f: Franchise): string {
  const names = [...new Set(f.seasons.map((s) => s.managerShort))]
  if (names.length <= 1) return f.teamName
  const past = names.filter((n) => n !== f.managerShort)
  return `${f.teamName} · prev. ${past.join(', ')}`
}

function ResultsGrid({ franchises, seasons, mine }: { franchises: Franchise[]; seasons: number[]; mine: number | null }) {
  const cols = [...seasons].sort((a, b) => a - b)
  const values = franchises.map((f) =>
    cols.map((y) => {
      const s = f.seasons.find((x) => x.seasonId === y)
      if (!s) return null
      return s.isComplete && s.finalRank ? s.finalRank : s.playoffSeed || null
    }),
  )
  const n = Math.max(1, ...franchises.map((f) => f.seasons.length ? 12 : 0))
  return (
    <Heatmap
      rowLabels={franchises.map((f) => (
        <Link to={`/team/${f.id}`}>{f.managerShort}</Link>
      ))}
      colLabels={cols.map((y) => (
        <Link to={`/season/${y}`}>{y}</Link>
      ))}
      values={values}
      scale={(v) => 1 - (v - 1) / (n - 1)}
      format={(v, r, c) => {
        const s = franchises[r].seasons.find((x) => x.seasonId === cols[c])
        const live = s && !s.isComplete
        return (
          <span className={s?.champion ? 'champ' : undefined}>
            {live ? `${ordinal(v)}*` : ordinal(v)}
            {s?.champion ? ' 🏆' : ''}
          </span>
        )
      }}
      title={(_v, r, c) => {
        const s = franchises[r].seasons.find((x) => x.seasonId === cols[c])
        return s ? `${s.managerName} · ${s.teamName} · seed ${s.playoffSeed} · ${s.record.wins}-${s.record.losses}-${s.record.ties}${s.isComplete ? '' : ' (live: current seed)'}` : ''
      }}
      rowClass={(r) => mineClass(mine, franchises[r].id)}
    />
  )
}
