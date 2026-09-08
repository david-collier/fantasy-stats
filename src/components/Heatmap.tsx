import type { ReactNode } from 'react'

interface Props {
  rowLabels: ReactNode[]
  colLabels: ReactNode[]
  /** values[row][col]; null renders an empty cell */
  values: (number | null)[][]
  /** text to show in a cell (default: the value) */
  format?: (v: number, r: number, c: number) => ReactNode
  /** map a value to 0..1 for coloring (default: linear min..max) */
  scale?: (v: number) => number
  /** true = high values are good (green) */
  highIsGood?: boolean
  title?: (v: number, r: number, c: number) => string
  rowClass?: (r: number) => string | undefined
}

/** Table heatmap; cell background from a green→yellow→orange scale. */
export default function Heatmap({ rowLabels, colLabels, values, format, scale, highIsGood = true, title, rowClass }: Props) {
  const flat = values.flat().filter((v): v is number => v !== null)
  const min = Math.min(...flat)
  const max = Math.max(...flat)
  const sc = scale ?? ((v: number) => (max === min ? 0.5 : (v - min) / (max - min)))
  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <thead>
          <tr>
            <th></th>
            {colLabels.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, r) => (
            <tr key={r} className={rowClass?.(r)}>
              <th>{rowLabels[r]}</th>
              {row.map((v, c) => {
                if (v === null) return <td key={c} className="empty" />
                let t = sc(v)
                if (!highIsGood) t = 1 - t
                return (
                  <td key={c} style={{ background: heat(t) }} title={title?.(v, r, c)}>
                    {format ? format(v, r, c) : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 0 = bad (orange), 0.5 = neutral (pale), 1 = good (green). */
export function heat(t: number): string {
  const x = Math.max(0, Math.min(1, t))
  // interpolate hue 30 (orange) -> 60 (yellow) -> 150 (green); keep saturation modest
  const hue = x < 0.5 ? 30 + x * 60 : 60 + (x - 0.5) * 180
  const light = 82 - Math.abs(x - 0.5) * 30
  return `hsl(${hue} 70% ${light}% / 0.85)`
}
