import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listSeasons, seasonIndex, useSeason } from '../data/loadSeason'
import { useMyTeam } from '../data/myTeam'
import Heatmap from '../components/Heatmap'
import ManagerLabel from '../components/ManagerLabel'
import SeasonPicker from '../components/SeasonPicker'
import { ActualVsExpected, CatRadar, HBar, WeekLines, XYScatter, franchiseColor } from '../components/charts'
import {
  analyzeWeek,
  categoryRanks,
  cumulativeTotals,
  expectedWins,
  netRecordSeries,
  periodsOf,
  powerRatings,
  seasonExpected,
  seasonTotals,
  weekTeams,
} from '../lib/analytics'
import { signed, statValue } from '../lib/format'
import type { SeasonData } from '../types/derived'

export default function Stats() {
  const params = useParams<{ season?: string }>()
  const seasonId = params.season ? Number(params.season) : seasonIndex.currentSeason
  const { data, loading, missing } = useSeason(seasonId)
  if (loading) return <p className="muted">Loading {seasonId}…</p>
  if (missing || !data) return <p className="muted">No data for {seasonId}.</p>
  return <StatsBody season={data} key={seasonId} />
}

function StatsBody({ season }: { season: SeasonData }) {
  const { franchiseId: mine } = useMyTeam()
  const teams = new Map(season.teams.map((t) => [t.id, t]))
  const short = (id: number) => teams.get(id)?.managerShort ?? `#${id}`
  const cats = season.league.categories

  const model = useMemo(() => {
    const rows = weekTeams(season)
    const periods = periodsOf(rows)
    const x = expectedWins(season, rows)
    const sx = seasonExpected(x)
    const totals = seasonTotals(season)
    const pr = powerRatings(cats, totals)
    const ranks = categoryRanks(cats, totals)
    const cum = cumulativeTotals(season, rows)
    const prSeries = periods.map((p) => {
      const snap = cum.get(p)!
      const r = powerRatings(cats, snap)
      const pt: Record<string, number> = { period: p }
      for (const v of r) pt[`t${v.teamId}`] = v.total
      return pt as { period: number } & Record<string, number>
    })
    const net = netRecordSeries(rows)
    const netSeries = periods.map((p) => {
      const pt: Record<string, number> = { period: p }
      for (const [teamId, pts] of net) {
        const hit = pts.find((q) => q.period === p)
        if (hit) pt[`t${teamId}`] = hit.net
      }
      return pt as { period: number } & Record<string, number>
    })
    return { rows, periods, x, sx, totals, pr, ranks, prSeries, netSeries }
  }, [season, cats])

  const [week, setWeek] = useState<number>(model.periods[model.periods.length - 1] ?? 1)
  const [radarTeam, setRadarTeam] = useState<number>(() => season.teams.find((t) => t.franchiseId === mine)?.id ?? season.teams[0].id)

  if (!model.periods.length) {
    return (
      <section>
        <PageHead season={season} />
        <p className="muted">No completed regular-season weeks yet.</p>
      </section>
    )
  }

  const weekX = model.x.filter((w) => w.period === week)
  const weekAnalysis = analyzeWeek(season, model.rows, model.x, week)
  const sorted = [...model.pr].sort((a, b) => b.total - a.total)
  const series = season.teams.map((t) => ({ key: `t${t.id}`, name: t.managerShort, id: t.franchiseId }))
  const byDiv = (d: number) => series.filter((s) => teams.get(Number(s.key.slice(1)))?.divisionId === d)
  const radarRows = model.x.filter((w) => w.teamId === radarTeam)
  const radarData = cats.map((c) => ({
    cat: c.name,
    share: radarRows.length ? radarRows.reduce((a, w) => a + (w.catShare[String(c.statId)] ?? 0), 0) / radarRows.length : 0,
  }))

  return (
    <section className="stats-page">
      <PageHead season={season} />

      <h3>Power ratings</h3>
      <p className="muted small">Sum of z-scores of season category totals (ERA/WHIP inverted). Batting and pitching are the six-category sub-sums.</p>
      <div className="two-col">
        <HBar data={sorted.map((p) => ({ name: short(p.teamId), value: p.total, id: teams.get(p.teamId)?.franchiseId }))} />
        <XYScatter data={model.pr.map((p) => ({ name: short(p.teamId), x: p.batting, y: p.pitching, z: p.total + 12, id: teams.get(p.teamId)?.franchiseId ?? p.teamId }))} xLabel="Batting" yLabel="Pitching" />
      </div>

      <h3>Power ratings throughout the season</h3>
      <p className="muted small">Recomputed each week from season-to-date totals (rate stats rebuilt from cumulative components).</p>
      <WeekLines data={model.prSeries} series={series} yLabel="Power rating" />

      <h3>Net record over time</h3>
      <p className="muted small">Category games over .500, i.e. (wins − losses) / 2, by division.</p>
      <div className="two-col">
        {season.league.divisions.map((d) => (
          <div key={d.id}>
            <h4 className="muted">{d.name}</h4>
            <WeekLines data={model.netSeries} series={byDiv(d.id)} height={260} />
          </div>
        ))}
      </div>

      <h3>Rank by category</h3>
      <Heatmap
        rowLabels={cats.map((c) => c.name)}
        colLabels={season.teams.map((t) => (
          <Link to={`/team/${t.franchiseId}`}>{t.managerShort}</Link>
        ))}
        values={cats.map((c) => season.teams.map((t) => model.ranks.get(t.id)?.[String(c.statId)] ?? null))}
        scale={(v) => 1 - (v - 1) / Math.max(1, season.teams.length - 1)}
        format={(v) => (v === 1 || v === season.teams.length ? v : '')}
        title={(v, r, c) => `${season.teams[c].managerShort} · ${cats[r].name}: rank ${v} (${statValue(cats[r].statId, model.totals.get(season.teams[c].id)?.[String(cats[r].statId)])})`}
      />

      <div className="page-head">
        <h3>Expected wins (xWins)</h3>
        <label>
          Week{' '}
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {model.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        xWins for a week = for each category, the share of the other {season.teams.length - 1} teams you would have beaten with your totals (ties count half), summed across the{' '}
        {cats.length} categories. Actual wins = category wins + ½ ties. Wins gained/lost = actual − expected.
      </p>
      <div className="two-col">
        <div>
          <h4 className="muted">Actual vs expected · week {week}</h4>
          <ActualVsExpected
            data={[...weekX].sort((a, b) => b.actualWins - a.actualWins).map((w) => ({ name: short(w.teamId), actual: w.actualWins, expected: w.xWins, id: teams.get(w.teamId)?.franchiseId ?? w.teamId }))}
          />
        </div>
        <div>
          <h4 className="muted">Wins gained/lost · week {week}</h4>
          <HBar data={[...weekX].sort((a, b) => b.actualWins - b.xWins - (a.actualWins - a.xWins)).map((w) => ({ name: short(w.teamId), value: w.actualWins - w.xWins }))} />
        </div>
      </div>

      <h4 className="muted">Matchups · week {week}</h4>
      <table className="data">
        <thead>
          <tr>
            <th>Matchup</th>
            <th className="num">xWins</th>
            <th className="num">Actual</th>
            <th className="num">Differential</th>
            <th className="num">Close cats</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {weekAnalysis.map((a) => {
            const h = teams.get(a.home.teamId)!
            const aw = teams.get(a.away.teamId)!
            const hw = a.matchup.winner === 'HOME'
            const awn = a.matchup.winner === 'AWAY'
            return (
              <tr key={a.matchup.id}>
                <td>
                  <span className={awn ? 'won' : ''}>
                    <ManagerLabel franchiseId={aw.franchiseId} managerName={aw.managerShort} compact />
                  </span>{' '}
                  <span className="muted">@</span>{' '}
                  <span className={hw ? 'won' : ''}>
                    <ManagerLabel franchiseId={h.franchiseId} managerName={h.managerShort} compact />
                  </span>
                </td>
                <td className="num">
                  {a.away.xWins.toFixed(1)} <span className="muted">–</span> {a.home.xWins.toFixed(1)}
                </td>
                <td className="num">
                  {a.away.catWins} <span className="muted">–</span> {a.home.catWins}
                </td>
                <td className="num" title="Σ per-category (home − away) in league weekly standard deviations">
                  {signed(a.home.differential)} <small className="muted">{h.managerShort}</small>
                </td>
                <td className="num" title={a.closeList.join(', ')}>
                  {a.closeCategories}
                </td>
                <td className="muted small">{a.matchup.winner === 'TIE' ? 'tie' : a.matchup.winner === 'UNDECIDED' ? 'live' : `${(hw ? h : aw).managerShort} by ${Math.abs(a.home.catWins - a.away.catWins)}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3>Season expectation</h3>
      <div className="three-col">
        <div>
          <h4 className="muted">Actual standings</h4>
          <HBar data={[...model.sx].sort((a, b) => b.actualWins - a.actualWins).map((s) => ({ name: short(s.teamId), value: s.actualWins, id: teams.get(s.teamId)?.franchiseId }))} byFranchise domain={[0, 'auto' as unknown as number]} />
        </div>
        <div>
          <h4 className="muted">Expected standings (Σ xWins)</h4>
          <HBar data={[...model.sx].sort((a, b) => b.xWins - a.xWins).map((s) => ({ name: short(s.teamId), value: s.xWins, id: teams.get(s.teamId)?.franchiseId }))} byFranchise domain={[0, 'auto' as unknown as number]} />
        </div>
        <div>
          <h4 className="muted">Total wins gained/lost</h4>
          <HBar data={[...model.sx].sort((a, b) => b.gained - a.gained).map((s) => ({ name: short(s.teamId), value: s.gained }))} digits={2} />
        </div>
      </div>

      <h3>Strength of schedule</h3>
      <p className="muted small">Average weekly xWins of the opponents actually faced. Higher = tougher.</p>
      <HBar data={[...model.sx].sort((a, b) => b.sos - a.sos).map((s) => ({ name: short(s.teamId), value: s.sos, id: teams.get(s.teamId)?.franchiseId }))} byFranchise domain={[0, 'auto' as unknown as number]} />

      <h3>Category totals</h3>
      <Heatmap
        rowLabels={season.teams.map((t) => (
          <Link to={`/team/${t.franchiseId}`}>{t.managerShort}</Link>
        ))}
        colLabels={cats.map((c) => c.name)}
        values={season.teams.map((t) => cats.map((c) => model.ranks.get(t.id)?.[String(c.statId)] ?? null))}
        scale={(v) => 1 - (v - 1) / Math.max(1, season.teams.length - 1)}
        format={(_v, r, c) => statValue(cats[c].statId, model.totals.get(season.teams[r].id)?.[String(cats[c].statId)])}
        title={(v, r, c) => `${season.teams[r].managerShort} · ${cats[c].name}: rank ${v}`}
        rowClass={(r) => (mine !== null && season.teams[r].franchiseId === mine ? 'mine' : undefined)}
      />

      <div className="page-head">
        <h3>Team strengths</h3>
        <label>
          Manager{' '}
          <select value={radarTeam} onChange={(e) => setRadarTeam(Number(e.target.value))}>
            {season.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.managerName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">Average weekly share of the league beaten in each category (0.5 = average).</p>
      <CatRadar data={radarData} series={[{ key: 'share', name: short(radarTeam), color: franchiseColor(teams.get(radarTeam)?.franchiseId ?? radarTeam) }]} max={1} height={340} />
    </section>
  )
}

function PageHead({ season }: { season: SeasonData }) {
  return (
    <div className="page-head">
      <div>
        <h2>{season.seasonId} Advanced Stats</h2>
        <p className="muted">Regular-season weeks only · {season.status.isComplete ? 'final' : `through week ${season.status.currentMatchupPeriod - 1}`}</p>
      </div>
      <SeasonPicker seasons={listSeasons()} value={season.seasonId} to={(s) => `/stats/${s}`} />
    </div>
  )
}
