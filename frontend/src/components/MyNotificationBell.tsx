import { useQuery } from '@tanstack/react-query'
import { BellOff, CalendarCheck, CalendarX2, ChevronRight, GraduationCap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyLeave, listMyTrainings } from '../api/me'
import { useAuth } from '../hooks/useAuth'
import { daysBetween, formatDate, isWithinDays, timeAgo, today } from '../lib/dates'
import { leaveTypeLabel } from '../lib/leave'
import { trainingDates, trainingPhase } from '../lib/training'
import { BellMenu } from './BellMenu'

/** Decisions older than this are no longer news. */
const RECENT_DAYS = 30
/** A training that starts within this many days is worth a reminder. */
const SOON_DAYS = 14
const SHOWN = 8

interface Notice {
  /** changes when the news changes, so a new decision or a new date shows up as unread again */
  key: string
  to: string
  icon: LucideIcon
  tone: string
  title: string
  detail: string
  /** the rejection reason, when there is one */
  note?: string
  when: string
  sortAt: number
}

const dayNumber = (iso: string) => Math.round(new Date(`${iso}T00:00:00`).getTime() / 86_400_000)

function readSeen(storeKey: string): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(storeKey) ?? '[]'))
  } catch {
    return new Set()
  }
}

function writeSeen(storeKey: string, seen: Set<string>) {
  try {
    // keep the list from growing for ever
    localStorage.setItem(storeKey, JSON.stringify([...seen].slice(-200)))
  } catch {
    // storage blocked: the bell then simply shows everything as new
  }
}

/**
 * The bell for an employee: the decisions on their leave requests (approved, or rejected with the reason) and
 * trainings that are about to start or under way. What they have already looked at stops counting.
 */
export function MyNotificationBell() {
  const { user } = useAuth()
  const storeKey = `smarthr.seen.${user?.id ?? 'anonymous'}`
  const [seen, setSeen] = useState(() => readSeen(storeKey))
  const [highlight, setHighlight] = useState<Set<string>>(new Set())

  const leave = useQuery({ queryKey: ['my', 'leave'], queryFn: listMyLeave, refetchInterval: 60_000, refetchOnWindowFocus: true })
  const trainings = useQuery({ queryKey: ['my', 'trainings'], queryFn: listMyTrainings, refetchInterval: 300_000, refetchOnWindowFocus: true })

  const notices = useMemo(() => {
    const list: Notice[] = []
    for (const request of leave.data ?? []) {
      if (request.status === 'PENDING') continue
      if (!isWithinDays(request.updatedAt, RECENT_DAYS)) continue
      const approved = request.status === 'APPROVED'
      const days = daysBetween(request.startDate, request.endDate)
      list.push({
        key: `leave:${request.id}:${request.updatedAt}`,
        to: '/my-leave',
        icon: approved ? CalendarCheck : CalendarX2,
        tone: approved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
        title: `Your ${leaveTypeLabel(request.type).toLowerCase()} leave was ${approved ? 'approved' : 'rejected'}`,
        detail: `${formatDate(request.startDate)}${request.endDate !== request.startDate ? ` – ${formatDate(request.endDate)}` : ''} · ${days} ${days === 1 ? 'day' : 'days'}`,
        note: approved ? undefined : (request.rejectionReason ?? undefined),
        when: timeAgo(request.updatedAt),
        sortAt: new Date(request.updatedAt).getTime(),
      })
    }
    const day = dayNumber(today())
    for (const training of trainings.data ?? []) {
      const phase = trainingPhase(training)
      const startsIn = training.startDate ? dayNumber(training.startDate) - day : null
      let title: string | null = null
      if (phase === 'Upcoming' && startsIn !== null && startsIn <= SOON_DAYS) {
        title = startsIn === 1 ? `${training.title} starts tomorrow` : `${training.title} starts in ${startsIn} days`
      } else if (phase === 'Ongoing') {
        title = `${training.title} is under way`
      }
      if (!title) continue
      list.push({
        key: `training:${training.id}:${training.startDate}:${training.endDate}:${phase}`,
        to: '/my-trainings',
        icon: GraduationCap,
        tone: 'bg-brand-100 text-brand-700',
        title,
        detail: `${trainingDates(training)}${training.trainer ? ` · with ${training.trainer}` : ''}`,
        when: phase === 'Upcoming' ? 'Reminder' : 'Now',
        // soonest first, after the decisions
        sortAt: -(startsIn ?? 0) - 1e15,
      })
    }
    return list.sort((a, b) => b.sortAt - a.sortAt).slice(0, SHOWN)
  }, [leave.data, trainings.data])

  const unread = notices.filter((notice) => !seen.has(notice.key)).length
  const label = unread === 0 ? 'Notifications: nothing new' : `Notifications: ${unread} new`

  // opening the menu counts everything in it as read; the ones that were new stay highlighted until it is closed
  function markAllSeen() {
    setHighlight(new Set(notices.filter((notice) => !seen.has(notice.key)).map((notice) => notice.key)))
    const next = new Set(seen)
    notices.forEach((notice) => next.add(notice.key))
    writeSeen(storeKey, next)
    setSeen(next)
  }

  return (
    <BellMenu
      label={label}
      count={unread}
      title="Notifications"
      headerBadge={unread > 0 && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">{unread} new</span>}
      onOpen={markAllSeen}
    >
      {(close) =>
        leave.isPending || trainings.isPending ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : notices.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BellOff aria-hidden className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
            <p className="mt-2 text-sm font-medium text-slate-700">Nothing new</p>
            <p className="text-xs text-slate-500">Answers to your leave requests and training reminders show up here.</p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {notices.map((notice) => {
              const Icon = notice.icon
              const isNew = highlight.has(notice.key)
              return (
                <li key={notice.key}>
                  <Link
                    to={notice.to}
                    onClick={close}
                    className={`flex gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 ${isNew ? 'bg-brand-50/40' : ''}`}
                  >
                    <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${notice.tone}`}>
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{notice.title}</p>
                        <span className="shrink-0 text-xs text-slate-400">{notice.when}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{notice.detail}</p>
                      {notice.note && (
                        <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">
                          <span className="font-medium">Reason:</span> {notice.note}
                        </p>
                      )}
                    </div>
                    <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-slate-300" />
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
