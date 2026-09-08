import { leagueSummary } from '../data/loadSeason'
import { useMyTeam } from '../data/myTeam'

/** "Your team" picker in the header; highlights that franchise's rows everywhere. */
export default function TeamSelector() {
  const { franchiseId, setFranchiseId } = useMyTeam()
  const options = [...leagueSummary.franchises].sort((a, b) => a.managerName.localeCompare(b.managerName))
  return (
    <label className="team-select">
      <span className="muted small">Your team</span>
      <select value={franchiseId ?? ''} onChange={(e) => setFranchiseId(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">— none —</option>
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {f.managerName} · {f.teamName}
          </option>
        ))}
      </select>
    </label>
  )
}
