import { api } from './client'
import type { Department, DepartmentInput } from './types'

export const listDepartments = () =>
  api.get<Department[]>('/department/search-all').then((r) => r.data)

export const createDepartment = (input: DepartmentInput) =>
  api.post<Department>('/department/create', input).then((r) => r.data)

export const updateDepartment = (id: string, input: DepartmentInput) =>
  api.put<Department>(`/department/${id}`, input).then((r) => r.data)

export const deleteDepartment = (id: string) => api.delete(`/department/${id}`).then(() => undefined)
