import { api } from './client'
import type { DashboardSummary } from './types'

/** Headcount by department and province, leave and training figures, computed on the server. */
export const getDashboardSummary = () => api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data)
