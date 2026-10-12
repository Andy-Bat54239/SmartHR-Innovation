import { api } from './client'
import type { LeaveBalance, LeaveInput, LeaveRequest, Me, Training, UserAccount } from './types'

export const getMe = () => api.get<Me>('/me').then((r) => r.data)

// Self-service: always about the signed-in person's own record, never an id chosen by the caller.
export const listMyLeave = () => api.get<LeaveRequest[]>('/me/leave').then((r) => r.data)

export const createMyLeave = (input: LeaveInput) => api.post<LeaveRequest>('/me/leave', input).then((r) => r.data)

export const updateMyLeave = (id: string, input: LeaveInput) => api.put<LeaveRequest>(`/me/leave/${id}`, input).then((r) => r.data)

/** Only while the request is still pending. */
export const withdrawMyLeave = (id: string) => api.delete(`/me/leave/${id}`).then(() => undefined)

export const listMyTrainings = () => api.get<Training[]>('/me/trainings').then((r) => r.data)

/** What is left of each kind of leave this year (or the year given). */
export const getMyLeaveBalance = (year?: number) => api.get<LeaveBalance[]>('/me/leave/balance', { params: { year } }).then((r) => r.data)

/** Emails about leave requests and trainings on or off. Security alerts are always sent. */
export const setEmailNotifications = (emailNotifications: boolean) =>
  api.put<UserAccount>('/me/notifications', { emailNotifications }).then((r) => r.data)
