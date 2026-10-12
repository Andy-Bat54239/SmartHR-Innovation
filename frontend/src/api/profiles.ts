import { api } from './client'
import type { EmployeeProfile, ProfileInput } from './types'

export const createProfile = (input: ProfileInput) =>
  api.post<EmployeeProfile>('/employee-profile/create', input).then((r) => r.data)

export const updateProfile = (id: string, input: ProfileInput) =>
  api.put<EmployeeProfile>(`/employee-profile/${id}`, input).then((r) => r.data)

export const deleteProfile = (id: string) => api.delete(`/employee-profile/${id}`).then(() => undefined)
