import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { leagueSummary, useAllSeasons, usePlayers, useSeasonTx } from '../data/loadSeason'
import { useMyTeam } from '../data/myTeam'
import Heatmap from '../components/Heatmap'
import RosterTable from '../components/RosterTable'
import TradeCard from '../components/TradeCard'
import { CatRadar, franchiseColor } from '../components/charts'
import { categoryRanks, powerRatings, seasonTotals } from '../lib/analytics'
import { ordinal, pct, pctString, recordString } from '../lib/format'
import { headToHead, catPct } from '../lib/h2h'
import { trades } from '../lib/timeline'

export default function TeamPage() {
  const params = useParams<{ franchiseId: string }>()
  const id = Number(params.franchiseId)
  const [search, setSearch] = useSearchParams()
  const { franchiseId: mine, setFranchiseId } = useMyTeam()
  const franchise = leagueSummary.franchises.find((f) => f.id === id)
  const all = useAllSeasons()
  const players = usePlayers()

  const rosterSeason = Number(search.get('season') ?? leagueSummary.currentSeason)
  const tx = useSeasonTx(rosterSeason)

  const analytics = useMemo(() => {
    if (!all.data) return undefined
    // Average category rank and z-score across seasons.
    const rankSum: Record<string, number[]> = {}
    const zSum: Record<string, number[]> = {}
    const cats = all.data[all.data.length - 1].league.categories
    for (const s of all.data) {
      const totals = seasonTotals(s)
      const ranks = categoryRanks(s.league.categories, totals).get(id)
      const pr = powerRatings(s.league.categories, totals).find((p) => p.teamId === id)
      for (const c of s.league.categories) {
        const k = String(c.statId)
        if (ranks?.[k]) (rankSum[k] ??= []).push(ranks[k])
        if (pr) (zSum[k] ??= []).push(pr.z[k])
      }
    }
    const avg = (xs: number[] | undefined) => (xs?.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
    return { cats, avgRank: cats.map((c) => avg(rankSum[String(c.statId)])), avgZ: cats.map((c) => avg(zSum[String(c.statId)])) }
  }, [all.data, id])

  if (!franchise) return <p className="muted">Unknown franchise.</p>
  const seasons = [...franchise.seasons].sort((a, b) => b.seasonId - a.seasonId)
  const done = franchise.seasons.filter((s) => s.isComplete)
  const w = franchise.seasons.reduce((a, s) => a + s.record.wins, 0)
  const l = franchise.seasons.reduce((a, s) => a + s.record.losses, 0)
  const t = franchise.seasons.reduce((a, s) => a + s.record.ties, 0)
  const finishes = done.map((s) => s.finalRank).filter(Boolean)
  const managers = [...new Set(franchise.seasons.map((s) => s.managerName))]
  const seasonData = all.data?.find((s) => s.seasonId === rosterSeason)
  const teamInSeason = seasonData?.teams.find((x) => x.franchiseId === id)
  const h2h = all.data ? headToHead(all.data, 'all').get(id) : undefined

  return (
    <section className="team-page">
      <div className="page-head">
        <div>
          <h2>{franchise.managerName}</h2>
          <p className="muted">
            {franchise.teamName} · franchise #{franchise.id} · {franchise.seasons[0].seasonId}–{franchise.seasons[franchise.seasons.length - 1].seasonId}
            {managers.length > 1 && <> · previous managers: {managers.filter((m) => m !== franchise.managerName).join(', ')}</>}
          </p>
        </div>
        <button className="linkish" onClick={() => setFranchiseId(mine === id ? null : id)}>
          {mine === id ? '★ This is my team' : '☆ Set as my team'}
        </button>
      </div>

      <div className="tiles">
        <Tile label="All-time" value={`${w}-${l}-${t}`} sub={pctString(pct(w, l, t))} />
        <Tile label="Titles" value={done.filter((s) => s.champion).length ? '🏆'.repeat(done.filter((s) => s.champion).length) : '0'} />
        <Tile label="Playoffs" value={`${done.filter((s) => s.madePlayoffs).length} / ${done.length}`} />
        <Tile label="Best finish" value={finishes.length ? ordinal(Math.min(...finishes)) : '—'} sub={finishes.length ? `avg ${(finishes.reduce((a, b) => a + b, 0) / finishes.length).toFixed(1)}` : undefined} />
      </div>

      <h3>Results by season</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Season</th>
            <th>Manager</th>
            <th>Team name</th>
            <th>Division</th>
            <th className="num">Cat W-L-T</th>
            <th className="num">Pct</th>
            <th className="num">Seed</th>
            <th className="num">Finish</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.seasonId} className={s.champion ? 'champion' : undefined}>
              <td>
                <Link to={`/season/${s.seasonId}`}>{s.seasonId}</Link>
              </td>
              <td>{s.managerName}</td>
              <td className="muted">{s.teamName}</td>
              <td>{s.divisionName && <span className={`badge div div-${s.divisionId}`}>{s.divisionName}</span>}</td>
              <td className="num">{recordString(s.record)}</td>
              <td className="num">{pctString(s.record.percentage)}</td>
              <td className="num">{s.playoffSeed || '—'}</td>
              <td className="num">
                {s.isComplete ? (s.finalRank ? ordinal(s.finalRank) : '—') : <span className="muted">live</span>}
                {s.champion && ' 🏆'}
                {s.madePlayoffs && !s.champion && s.isComplete && <span className="badge">PO</span>}
              </td>
              <td className="links">
                <Link to={`/team/${id}?season=${s.seasonId}`}>Roster</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {analytics && (
        <div className="two-col">
          <div>
            <h3>Category strengths</h3>
            <p className="muted small">Average league rank per category across all seasons (1 = best of 12).</p>
            <Heatmap
              rowLabels={['Avg rank']}
              colLabels={analytics.cats.map((c) => c.name)}
              values={[analytics.avgRank.map((v) => (Number.isNaN(v) ? null : v))]}
              scale={(v) => 1 - (v - 1) / 11}
              format={(v) => v.toFixed(1)}
            />
          </div>
          <div>
            <CatRadar
              data={analytics.cats.map((c, i) => ({ cat: c.name, z: Number.isNaN(analytics.avgZ[i]) ? 0 : Math.max(0, analytics.avgZ[i] + 2) }))}
              series={[{ key: 'z', name: 'avg z-score (+2)', color: franchiseColor(id) }]}
              max={4}
              height={260}
            />
          </div>
        </div>
      )}

      <div className="page-head">
        <h3>Roster</h3>
        <label>
          Season{' '}
          <select value={rosterSeason} onChange={(e) => setSearch({ season: e.target.value })}>
            {seasons.map((s) => (
              <option key={s.seasonId} value={s.seasonId}>
                {s.seasonId}
              </option>
            ))}
          </select>
        </label>
      </div>
      {seasonData && teamInSeason ? <RosterTable season={seasonData} teamId={teamInSeason.id} players={players.data} /> : <p className="muted">Loading…</p>}

      {seasonData && teamInSeason && (
        <>
          <h3>
            Trades in {rosterSeason} <small className="muted">({trades(tx.data).filter((tr) => tr.items.some((i) => i.fromTeamId === teamInSeason.id || i.toTeamId === teamInSeason.id)).length})</small>
          </h3>
          {!seasonData.hasTransactions && <p className="muted small">No transaction log from ESPN for this season.</p>}
          <div className="trades">
            {trades(tx.data)
              .filter((tr) => tr.items.some((i) => i.fromTeamId === teamInSeason.id || i.toTeamId === teamInSeason.id))
              .map((tr) => (
                <TradeCard key={tr.id} t={tr} season={seasonData} tx={tx.data} players={players.data} />
              ))}
          </div>
        </>
      )}

      {h2h && (
        <>
          <h3>Head-to-head</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Opponent</th>
                <th className="num">Matchups</th>
                <th className="num">W-L-T</th>
                <th className="num">Categories</th>
                <th className="num">Pct</th>
              </tr>
            </thead>
            <tbody>
              {leagueSummary.franchises
                .filter((f) => f.id !== id)
                .map((f) => ({ f, c: h2h.get(f.id) }))
                .sort((a, b) => (b.c ? catPct(b.c) : 0) - (a.c ? catPct(a.c) : 0))
                .map(({ f, c }) => (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/team/${f.id}`}>{f.managerName}</Link> <small className="muted">{f.teamName}</small>
                    </td>
                    <td className="num">{c?.games ?? 0}</td>
                    <td className="num">{c ? `${c.wins}-${c.losses}${c.ties ? `-${c.ties}` : ''}` : '—'}</td>
                    <td className="num">{c ? `${c.catWins}-${c.catLosses}-${c.catTies}` : '—'}</td>
                    <td className="num">{c ? pctString(catPct(c)) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <small className="muted">{label}</small>
      <b>{value}</b>
      {sub && <small className="muted">{sub}</small>}
    </div>
  )
}
