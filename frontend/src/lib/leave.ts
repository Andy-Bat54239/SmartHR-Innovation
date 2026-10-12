import type { BadgeTone } from '../components/Badge'
import type { LeaveStatus, LeaveType } from '../api/types'

export const leaveTypeLabel = (type: LeaveType) => type.charAt(0) + type.slice(1).toLowerCase()

export const leaveStatusLabel = (status: LeaveStatus) => status.charAt(0) + status.slice(1).toLowerCase()

export const leaveStatusTone: Record<LeaveStatus, BadgeTone> = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' }
