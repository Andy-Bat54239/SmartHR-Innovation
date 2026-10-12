import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { searchLeaves } from '../api/leaves'
import { daysBetween, formatDate, timeAgo } from '../lib/dates'
import { leaveTypeLabel } from '../lib/leave'
import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { BellMenu } from './BellMenu'

/** How many waiting requests the dropdown lists; the rest are one click away on the leave page. */
const SHOWN = 5

/**
 * The bell for people who decide leave: a red count of the requests waiting, and a dropdown with the newest
 * ones (who, what kind, which dates, how long ago) that each lead to the pending list.
 */
export function NotificationBell() {
  const pending = useQuery({
    queryKey: ['leaves', 'pending-notifications'],
    queryFn: () => searchLeaves({ page: 0, size: SHOWN, sortBy: 'createdAt', direction: 'desc', status: 'PENDING' }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const count = pending.data?.page.totalElements ?? 0
  const items = pending.data?.content ?? []
  const label = count === 0 ? 'Notifications: nothing waiting' : `Notifications: ${count} leave ${count === 1 ? 'request' : 'requests'} waiting for a decision`

  return (
    <BellMenu
      label={label}
      count={count}
      title="Notifications"
      headerBadge={count > 0 && <Badge tone="amber">{count} waiting</Badge>}
      footer={(close) =>
        count > 0 && (
          <Link
            to="/leaves?status=PENDING"
            onClick={close}
            className="flex items-center justify-center gap-1 border-t border-slate-100 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            {count > items.length ? `View all ${count} pending requests` : 'Review pending requests'}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        )
      }
    >
      {(close) =>
        pending.isError ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Could not load notifications.</p>
        ) : pending.isPending ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CalendarCheck aria-hidden className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
            <p className="mt-2 text-sm font-medium text-slate-700">You are all caught up</p>
            <p className="text-xs text-slate-500">No leave requests are waiting for a decision.</p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.map((leave) => {
              const days = daysBetween(leave.startDate, leave.endDate)
              const name = `${leave.employee.firstName} ${leave.employee.lastName}`
              return (
                <li key={leave.id}>
                  <Link
                    to="/leaves?status=PENDING"
                    onClick={close}
                    className="flex gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <Avatar firstName={leave.employee.firstName} lastName={leave.employee.lastName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                        <span className="shrink-0 text-xs text-slate-400">{timeAgo(leave.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Asked for <Badge tone="brand">{leaveTypeLabel(leave.type)}</Badge> leave
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        {formatDate(leave.startDate)}
                        {leave.endDate !== leave.startDate && ` – ${formatDate(leave.endDate)}`}
                        <span className="text-slate-400"> · </span>
                        {days} {days === 1 ? 'day' : 'days'}
                      </p>
                      {leave.reason && <p className="mt-1 truncate text-xs text-slate-500 italic">“{leave.reason}”</p>}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      }
    </BellMenu>
  )
}
