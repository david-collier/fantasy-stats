import { Link } from 'react-router-dom'

interface Props {
  franchiseId: number
  managerName: string
  teamName?: string
  /** Link the manager name to the franchise page (default true). */
  link?: boolean
  /** Hide the secondary team name. */
  compact?: boolean
}

/** Manager first, team name second — the manager is the identity, the team name is the flavor. */
export default function ManagerLabel({ franchiseId, managerName, teamName, link = true, compact = false }: Props) {
  const name = link ? <Link to={`/team/${franchiseId}`}>{managerName}</Link> : <span>{managerName}</span>
  return (
    <span className="mgr">
      <b>{name}</b>
      {!compact && teamName && <small>{teamName}</small>}
    </span>
  )
}
