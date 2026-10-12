import { api } from './client'
import type { AuditAction, AuditEntityType, AuditEvent, Page } from './types'

/** Optional filters of the audit search; every one that is set narrows the result (they combine with AND). */
export interface AuditFilters {
  /** text in the sentence, the actor's name or the record's name */
  q?: string
  action?: AuditAction
  entityType?: AuditEntityType
  /** one record's whole history */
  entityId?: string
  /** text in the username of whoever did it */
  actor?: string
  /** yyyy-MM-dd, inclusive */
  from?: string
  to?: string
}

export interface AuditQuery extends AuditFilters {
  page: number
  size: number
  sortBy: string
  direction: 'asc' | 'desc'
}

/** Fields the API can sort the trail by (it answers 400 for anything else). */
export const AUDIT_SORT_FIELDS = ['occurredAt', 'action', 'entityType', 'actorUsername'] as const

/** Administrators only. The trail is read-only: there is nothing to add, change or remove through the API. */
export const searchAudit = (query: AuditQuery) => api.get<Page<AuditEvent>>('/audit/search-page', { params: query }).then((r) => r.data)
