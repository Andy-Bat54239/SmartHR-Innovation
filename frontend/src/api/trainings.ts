import { api } from './client'
import type { Employee, Training, TrainingInput } from './types'

export const listTrainings = () => api.get<Training[]>('/training/search-all').then((r) => r.data)

export const getTraining = (id: string) => api.get<Training>(`/training/search/${id}`).then((r) => r.data)

export const createTraining = (input: TrainingInput) => api.post<Training>('/training/create', input).then((r) => r.data)

export const updateTraining = (id: string, input: TrainingInput) =>
  api.put<Training>(`/training/${id}`, input).then((r) => r.data)

/** Also un-enrols everyone. */
export const deleteTraining = (id: string) => api.delete(`/training/${id}`).then(() => undefined)

/** The employees enrolled in a training. */
export const listEnrolled = (trainingId: string) =>
  api.get<Employee[]>(`/training/${trainingId}/employees`).then((r) => r.data)

/** 409 if the employee is already enrolled. */
export const enrolEmployee = (trainingId: string, employeeId: string) =>
  api.post<Training>(`/training/${trainingId}/assign/${employeeId}`).then((r) => r.data)

/** 404 if the employee is not enrolled. */
export const removeEmployee = (trainingId: string, employeeId: string) =>
  api.delete<Training>(`/training/${trainingId}/remove/${employeeId}`).then((r) => r.data)
