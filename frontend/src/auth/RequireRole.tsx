import { Outlet } from 'react-router-dom'
import type { Role } from '../api/types'
import { AccessDenied } from '../components/AccessDenied'
import { useAuth } from '../hooks/useAuth'

/** Shows the pages below only to these roles; everybody else sees "no access" (the API refuses them too). */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { hasRole } = useAuth()
  return hasRole(...roles) ? <Outlet /> : <AccessDenied />
}
