import { useNavigate } from 'react-router-dom'

interface Props {
  seasons: number[]
  value: number
  /** Build the route for a chosen season. */
  to: (season: number) => string
}

export default function SeasonPicker({ seasons, value, to }: Props) {
  const navigate = useNavigate()
  return (
    <label>
      Season{' '}
      <select value={value} onChange={(e) => navigate(to(Number(e.target.value)))}>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  )
}
