import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { AUDIT_SORT_FIELDS, searchAudit } from '../../api/audit'
import type { AuditQuery } from '../../api/audit'
import { errorMessage } from '../../api/client'
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../api/types'
import type { AuditChange, AuditEvent } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { LoadError, Loading } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { SortHeader } from '../../components/SortHeader'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { oneOf, useKeepPageInRange, useUrlParams, wholeNumber } from '../../hooks/useUrlParams'
import { useUrlSearchBox } from '../../hooks/useUrlSearchBox'
import { auditActionLabel, auditActionTone, auditEntityLabel } from '../../lib/audit'
import { formatDateTime } from '../../lib/dates'
import { filterControl } from '../../lib/styles'
import { roleLabel, roleTone } from '../../lib/role'
import type { Role } from '../../api/types'

const AUDIT_PAGE_SIZES = [25, 50, 100] as const
const HIDDEN = '(hidden)'

/** Anything the URL holds that we do not recognise falls back to a default. Newest first. */
function parseQuery(params: URLSearchParams): AuditQuery {
  const size = wholeNumber(params, 'size', AUDIT_PAGE_SIZES[0])
  return {
    page: wholeNumber(params, 'page', 0),
    size: (AUDIT_PAGE_SIZES as readonly number[]).includes(size) ? size : AUDIT_PAGE_SIZES[0],
    sortBy: oneOf(params.get('sortBy'), AUDIT_SORT_FIELDS) ?? 'occurredAt',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
    q: params.get('q') || undefined,
    action: oneOf(params.get('action'), AUDIT_ACTIONS),
    entityType: oneOf(params.get('entityType'), AUDIT_ENTITIES),
    entityId: params.get('entityId') || undefined,
    actor: params.get('actor') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  }
}

/** Who did what, to which record, when: read-only, administrators only. */
export default function AuditPage() {
  useDocumentTitle('Audit log')
  const { params, update } = useUrlParams()
  const query = useMemo(() => parseQuery(params), [params])

  const events = useQuery({
    queryKey: ['audit', query],
    queryFn: () => searchAudit(query),
    placeholderData: keepPreviousData,
  })
  useKeepPageInRange(events.isPlaceholderData ? undefined : events.data?.page.totalPages, query.page, update)

  const search = useUrlSearchBox(query.q, (q) => update({ q }))
  const actor = useUrlSearchBox(query.actor, (value) => update({ actor: value }))

  const filtersActive = Boolean(query.q || query.action || query.entityType || query.entityId || query.actor || query.from || query.to)
  function clearFilters() {
    search.reset()
    actor.reset()
    update({ q: undefined, action: undefined, entityType: undefined, entityId: undefined, actor: undefined, from: undefined, to: undefined })
  }
  /** Everything that ever happened to one record, and nothing else. */
  function showHistory(event: AuditEvent) {
    search.reset()
    actor.reset()
    update({ entityId: event.entityId ?? undefined, q: undefined, action: undefined, entityType: undefined, actor: undefined, from: undefined, to: undefined })
  }
  function sortBy(field: string) {
    if (query.sortBy === field) update({ direction: query.direction === 'asc' ? 'desc' : 'asc' })
    else update({ sortBy: field, direction: field === 'occurredAt' ? 'desc' : 'asc' })
  }

  const data = events.data

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-slate-500">
            Who did what, and when. Entries are written by the system as things happen and cannot be edited or deleted. National IDs, dates of
            birth and passwords are never recorded.
          </p>
        </div>
        <Button variant="secondary" onClick={() => events.refetch()} disabled={events.isFetching}>
          {events.isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search.text}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder="Search the log"
          aria-label="Search the log"
          className={`${filterControl} w-full sm:w-52`}
        />
        <input
          type="search"
          value={actor.text}
          onChange={(e) => actor.onChange(e.target.value)}
          placeholder="Who (username)"
          aria-label="Filter by who did it"
          className={`${filterControl} w-full sm:w-44`}
        />
        <select aria-label="Filter by action" value={query.action ?? ''} onChange={(e) => update({ action: e.target.value })} className={filterControl}>
          <option value="">Any action</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{auditActionLabel[a]}</option>
          ))}
        </select>
        <select aria-label="Filter by kind of record" value={query.entityType ?? ''} onChange={(e) => update({ entityType: e.target.value })} className={filterControl}>
          <option value="">Any record</option>
          {AUDIT_ENTITIES.map((t) => (
            <option key={t} value={t}>{auditEntityLabel[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          From
          <input type="date" value={query.from ?? ''} max={query.to} onChange={(e) => update({ from: e.target.value })} className={filterControl} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          To
          <input type="date" value={query.to ?? ''} min={query.from} onChange={(e) => update({ to: e.target.value })} className={filterControl} />
        </label>
        {filtersActive && (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {query.entityId && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-900">
          Showing the history of one record.
          <button type="button" onClick={clearFilters} className="font-medium underline hover:no-underline">
            Show everything
          </button>
        </p>
      )}

      {events.isPending && <Loading />}
      {events.isError && <LoadError message={errorMessage(events.error)} onRetry={() => events.refetch()} />}

      {data && (
        <div className={events.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.content.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {filtersActive ? 'Nothing in the log matches these filters.' : 'Nothing has been recorded yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="stack-table min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">Audit log</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <SortHeader label="When" field="occurredAt" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <SortHeader label="Who" field="actorUsername" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <SortHeader label="Action" field="action" activeField={query.sortBy} direction={query.direction} onSort={sortBy} />
                    <th scope="col" className="px-4 py-3">What</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.content.map((event) => (
                    <EventRow key={event.id} event={event} onHistory={() => showHistory(event)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            sizes={AUDIT_PAGE_SIZES}
            page={data.page.number}
            size={data.page.size}
            totalPages={data.page.totalPages}
            totalElements={data.page.totalElements}
            onPage={(page) => update({ page: page === 0 ? undefined : String(page) }, true)}
            onSize={(size) => update({ size: size === AUDIT_PAGE_SIZES[0] ? undefined : String(size) })}
          />
        </div>
      )}
    </div>
  )
}

function EventRow({ event, onHistory }: { event: AuditEvent; onHistory: () => void }) {
  const role = event.actorRole as Role | null
  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDateTime(event.occurredAt)}</td>
      <td className="px-4 py-3">
        {/* break-words: wraps only when a name cannot fit at all, instead of cutting ordinary addresses in half */}
        <div className="font-medium break-words text-slate-900">{event.actorUsername}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {role && roleLabel[role] && <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>}
          {event.ipAddress && <span title="Where the request came from">{event.ipAddress}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tone={auditActionTone[event.action]}>{auditActionLabel[event.action]}</Badge>
      </td>
      <td className="min-w-72 px-4 py-3">
        <div className="text-slate-900">{event.summary}</div>
        {event.note && <div className="mt-0.5 text-xs text-slate-500">{event.note}</div>}
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>{auditEntityLabel[event.entityType]}</span>
          {event.entityId && (
            <button type="button" onClick={onHistory} className="font-medium text-brand-600 hover:underline">
              History of this record
            </button>
          )}
        </div>
        {event.changes.length > 0 && <ChangeDetails changes={event.changes} />}
      </td>
    </tr>
  )
}

/** The fields of one event, before and after. A sensitive field only says that it is hidden. */
function ChangeDetails({ changes }: { changes: AuditChange[] }) {
  const value = (text: string | null) =>
    text === null ? <span className="text-slate-400">—</span> : text === HIDDEN ? <em className="text-slate-500">not recorded</em> : text
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-xs font-medium text-brand-600 hover:underline">
        {changes.length} {changes.length === 1 ? 'field' : 'fields'}
      </summary>
      <table className="mt-2 w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Field</th>
            <th scope="col" className="py-1 pr-3 font-medium">Before</th>
            <th scope="col" className="py-1 font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.field} className="border-t border-slate-100">
              <td className="py-1 pr-3 font-medium text-slate-700">{change.field}</td>
              <td className="py-1 pr-3 break-words text-red-800/80">{value(change.oldValue)}</td>
              <td className="py-1 break-words text-emerald-800">{value(change.newValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
