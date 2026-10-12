import { api } from './client'
import type { LeaveBalance, LeaveInput, LeaveRequest, LeaveStatus, LeaveType, Page } from './types'

/** Optional filters of the search. Every one that is set narrows the result (they combine with AND). */
export interface LeaveFilters {
  status?: LeaveStatus
  type?: LeaveType
  employeeId?: string
}

export interface LeaveQuery extends LeaveFilters {
  page: number
  size: number
  sortBy: string
  direction: 'asc' | 'desc'
}

/** Fields the API can sort leave requests by (it answers 400 for anything else). */
export const LEAVE_SORT_FIELDS = ['startDate', 'endDate', 'status', 'type', 'createdAt'] as const

export const searchLeaves = (query: LeaveQuery) =>
  api.get<Page<LeaveRequest>>('/leave/search-page', { params: query }).then((r) => r.data)

/** Always starts PENDING, whatever the client sends. */
export const createLeave = (input: LeaveInput) => api.post<LeaveRequest>('/leave/create', input).then((r) => r.data)

/** Only a PENDING request can be edited (409 otherwise). */
export const updateLeave = (id: string, input: LeaveInput) =>
  api.put<LeaveRequest>(`/leave/${id}`, input).then((r) => r.data)

export const deleteLeave = (id: string) => api.delete(`/leave/${id}`).then(() => undefined)

/** Only a PENDING request can be decided, and a decision is final (409 after that). */
export const approveLeave = (id: string) => api.patch<LeaveRequest>(`/leave/${id}/approve`).then((r) => r.data)
/** A rejection always needs a reason (400 on `reason` otherwise); the employee sees it. */
export const rejectLeave = (id: string, reason: string) =>
  api.patch<LeaveRequest>(`/leave/${id}/reject`, { reason }).then((r) => r.data)

/** What is left of each kind of leave for one employee this year (or the year given). */
export const getEmployeeLeaveBalance = (employeeId: string, year?: number) =>
  api.get<LeaveBalance[]>(`/leave/employee/${employeeId}/balance`, { params: { year } }).then((r) => r.data)
