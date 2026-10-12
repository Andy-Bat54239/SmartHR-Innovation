import type { BadgeTone } from '../components/Badge'
import type { Role } from '../api/types'

export const roleLabel: Record<Role, string> = { ADMIN: 'Administrator', HR: 'HR', EMPLOYEE: 'Employee' }

export const roleTone: Record<Role, BadgeTone> = { ADMIN: 'brand', HR: 'green', EMPLOYEE: 'slate' }
