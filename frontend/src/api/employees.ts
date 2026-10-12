import { api } from './client'
import type { Employee, EmployeeInput, EmployeeStatus, Gender, Page } from './types'

/** Optional filters of the search. Every one that is set narrows the result (they combine with AND). */
export interface EmployeeFilters {
  /** text found in the name, email or phone */
  q?: string
  status?: EmployeeStatus
  gender?: Gender
  departmentId?: string
  provinceId?: string
}

export interface EmployeeQuery extends EmployeeFilters {
  page: number
  size: number
  sortBy: string
  direction: 'asc' | 'desc'
}

/** Fields the API can sort employees by (it answers 400 for anything else). */
export const EMPLOYEE_SORT_FIELDS = ['firstName', 'lastName', 'email', 'hireDate', 'status', 'gender', 'createdAt'] as const

// axios leaves undefined params out of the URL, so unset filters are simply not sent
export const searchEmployees = (query: EmployeeQuery) =>
  api.get<Page<Employee>>('/employee/search-page', { params: query }).then((r) => r.data)

/** Every employee, unpaged: for dropdowns (who is this leave for, who to enrol). */
export const listAllEmployees = () => api.get<Employee[]>('/employee/search-all').then((r) => r.data)

export const createEmployee = (input: EmployeeInput) =>
  api.post<Employee>('/employee/create', input).then((r) => r.data)

export const updateEmployee = (id: string, input: EmployeeInput) =>
  api.put<Employee>(`/employee/${id}`, input).then((r) => r.data)

/** Also deletes the employee's profile, leave requests and training enrolments. */
export const deleteEmployee = (id: string) => api.delete(`/employee/${id}`).then(() => undefined)
