/**
 * Thin Recharts wrappers with a consistent look. Colors per franchise are stable
 * across the site (franchiseColor), so the same manager is the same hue everywhere.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

const PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#1b9e77', '#d95f02']

export function franchiseColor(id: number): string {
  return PALETTE[(id - 1) % PALETTE.length]
}

export const POS = 'var(--pos)'
export const NEG = 'var(--neg)'

interface BarDatum {
  name: string
  value: number
  id?: number
}

/** Horizontal bars, sorted as given, colored by sign (or by franchise when `byFranchise`). */
export function HBar({ data, height, byFranchise = false, digits = 1, domain }: { data: BarDatum[]; height?: number; byFranchise?: boolean; digits?: number; domain?: [number, number] }) {
  const h = height ?? Math.max(160, data.length * 28 + 30)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--line)" />
        <XAxis type="number" domain={domain ?? ['auto', 'auto']} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(digits) : String(v))} />
        <ReferenceLine x={0} stroke="var(--muted)" />
        <Bar dataKey="value" isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={byFranchise && d.id !== undefined ? franchiseColor(d.id) : d.value >= 0 ? POS : NEG} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(digits) : String(v))} style={{ fontSize: 11, fill: 'var(--text)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface SeriesPoint {
  period: number
  [key: string]: number
}

/** Multi-line chart over weeks. `series` = { key, name, id }. */
export function WeekLines({ data, series, height = 320, yLabel, zeroLine = true }: { data: SeriesPoint[]; series: { key: string; name: string; id: number }[]; height?: number; yLabel?: string; zeroLine?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} label={{ value: 'Week', position: 'insideBottomRight', offset: -4, fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={40} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined} />
        <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))} labelFormatter={(l) => `Week ${l}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {zeroLine && <ReferenceLine y={0} stroke="var(--muted)" />}
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={franchiseColor(s.id)} dot={false} strokeWidth={2} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface ScatterDatum {
  name: string
  x: number
  y: number
  z: number
  id: number
}

export function XYScatter({ data, xLabel, yLabel, height = 360 }: { data: ScatterDatum[]; xLabel: string; yLabel: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ left: 0, right: 24, top: 16, bottom: 16 }}>
        <CartesianGrid stroke="var(--line)" />
        <XAxis type="number" dataKey="x" name={xLabel} tick={{ fontSize: 11 }} label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 11 }} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={{ fontSize: 11 }} width={40} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <ZAxis type="number" dataKey="z" range={[60, 400]} />
        <ReferenceLine x={0} stroke="var(--muted)" />
        <ReferenceLine y={0} stroke="var(--muted)" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} />
        <Scatter data={data} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.id} fill={franchiseColor(d.id)} />
          ))}
          <LabelList dataKey="name" position="top" style={{ fontSize: 11, fill: 'var(--text)' }} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

interface RadarSeries {
  key: string
  name: string
  color: string
}

/** Radar over categories. data = [{ cat: 'HR', a: 0.7, b: 0.3 }, ...] */
export function CatRadar({ data, series, height = 300, max = 1 }: { data: Record<string, string | number>[]; series: RadarSeries[]; height?: number; max?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="var(--line)" />
        <PolarAngleAxis dataKey="cat" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
        {series.map((s) => (
          <Radar key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.15} isAnimationActive={false} />
        ))}
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/** Grouped vertical bars: actual vs expected. */
export function ActualVsExpected({ data, height = 300 }: { data: { name: string; actual: number; expected: number; id: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
        <YAxis tick={{ fontSize: 11 }} width={36} />
        <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="actual" name="Actual wins" isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.actual >= d.expected ? POS : NEG} />
          ))}
        </Bar>
        <Bar dataKey="expected" name="xWins" fill="var(--muted)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
