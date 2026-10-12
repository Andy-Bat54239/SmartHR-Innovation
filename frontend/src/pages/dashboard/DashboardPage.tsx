import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarClock, CalendarDays, CalendarPlus, GraduationCap, Hourglass, UserCheck, UserPlus, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { getDashboardSummary } from '../../api/dashboard'
import { listTrainings } from '../../api/trainings'
import type { DashboardSummary, GroupCount } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Badge } from '../../components/Badge'
import { BarList } from '../../components/BarList'
import type { BarItem } from '../../components/BarList'
import { DonutChart } from '../../components/charts/DonutChart'
import { GrowthChart, GrowthTable } from '../../components/charts/GrowthChart'
import { LoadError, Loading } from '../../components/Feedback'
import { HillsBanner } from '../../components/HillsBanner'
import { Panel } from '../../components/Panel'
import { StatTile } from '../../components/StatTile'
import type { Delta } from '../../components/StatTile'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { departmentSlices } from '../../lib/chart'
import { daysBetween, formatDate, today } from '../../lib/dates'
import { leaveTypeLabel } from '../../lib/leave'
import { phaseTone, trainingDates, trainingPhase } from '../../lib/training'

/** Turns the API's groups into bars; a group with an id links to the employee list filtered by it. */
function toBars(groups: GroupCount[], filterParam: 'departmentId' | 'provinceId'): BarItem[] {
  return groups.map((group) => ({
    key: group.id ?? group.name,
    label: group.name,
    count: group.count,
    to: group.id ? `/employees?${filterParam}=${group.id}` : undefined,
    muted: group.id === null,
  }))
}

/** Change as a whole percent, or nothing when there was nothing before to compare with. */
function percentChange(now: number, before: number): number | undefined {
  return before > 0 ? Math.round(((now - before) / before) * 100) : undefined
}

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en')} ${count === 1 ? one : many}`

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()

  // These are refetched each time the page is opened, so the numbers are always current.
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: getDashboardSummary })
  const trainings = useQuery({ queryKey: ['trainings', 'list'], queryFn: listTrainings })

  // read once when the page opens (a lazy initial value is the place for an impure call like the clock)
  const [now] = useState(() => {
    const date = new Date()
    return {
      greeting: date.getHours() < 12 ? 'Good morning' : date.getHours() < 18 ? 'Good afternoon' : 'Good evening',
      date: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      iso: today(),
    }
  })
  const firstName = user?.employee?.firstName ?? user?.username.split('@')[0] ?? ''

  // running or starting soon: what is going on now comes first, then the next to start
  const underway = [...(trainings.data ?? [])]
    .filter((t) => ['Ongoing', 'Upcoming'].includes(trainingPhase(t)))
    .sort((a, b) => Number(trainingPhase(b) === 'Ongoing') - Number(trainingPhase(a) === 'Ongoing') || (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <div>
            <p className="text-sm font-medium text-slate-700">{now.greeting},</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{firstName} </h1>
            <p className="mt-1 text-sm text-slate-500">Here&rsquo;s what&rsquo;s happening in your HR today.</p>
          </div>
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays aria-hidden className="size-4 text-slate-400" />
            {now.date}
          </p>
        </div>
        <HillsBanner className="hidden h-28 md:block" />
      </div>

      {summary.isPending && <Loading />}
      {summary.isError && <LoadError message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />}

      {summary.isSuccess && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <Tiles data={summary.data} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <GrowthPanel data={summary.data} />
              <Panel title="Employees by department" subtitle="Who works where">
                {summary.data.employees.total === 0 ? (
                  <EmptyNote>
                    No employees yet. <Link to="/employees?new=1" className="font-medium text-brand-700 hover:underline">Add the first one.</Link>
                  </EmptyNote>
                ) : (
                  <DonutChart slices={departmentSlices(summary.data.byDepartment)} unit="employee" totalLabel="Total" label="Employees by department" />
                )}
              </Panel>
            </div>

            <RecentEmployees rows={summary.data.recentEmployees} />

            <Panel title="Employees by province" subtitle="Where they live, rolled up from any level of the location tree">
              {summary.data.employees.total === 0 ? (
                <EmptyNote>Headcount by province appears once employees have a location.</EmptyNote>
              ) : (
                <BarList items={toBars(summary.data.byProvince, 'provinceId')} unit="employee" total={summary.data.employees.total} />
              )}
            </Panel>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <UpcomingLeave rows={summary.data.upcomingLeave} todayIso={now.iso} />
            <QuickActions />
            <Panel title="Trainings" action={{ to: '/trainings', label: 'View all' }} className="md:col-span-2 xl:col-span-1">
              {trainings.isPending && <Loading />}
              {trainings.isError && <LoadError message={errorMessage(trainings.error)} onRetry={() => trainings.refetch()} />}
              {trainings.isSuccess &&
                (underway.length === 0 ? (
                  <EmptyNote>No training is running or coming up.</EmptyNote>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {underway.map((training) => {
                      const phase = trainingPhase(training)
                      return (
                        <li key={training.id}>
                          <Link to={`/trainings/${training.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-2.5 hover:bg-slate-50">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900">{training.title}</span>
                              <span className="block text-xs text-slate-500">{trainingDates(training)}</span>
                            </span>
                            <Badge tone={phaseTone[phase]}>{phase}</Badge>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ))}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}

/** The four headline numbers. Every figure is counted on the server; a change is shown only where there is something to compare with. */
function Tiles({ data }: { data: DashboardSummary }) {
  const months = data.headcountByMonth
  const nowTotal = months.at(-1)?.total ?? data.employees.total
  const lastMonthTotal = months.at(-2)?.total ?? 0
  const newThisMonth = nowTotal - lastMonthTotal
  const growth = percentChange(nowTotal, lastMonthTotal)

  const leave = data.leave
  const leaveChange = percentChange(leave.onLeaveToday, leave.onLeaveLastWeek)
  const availableShare = data.employees.active > 0 ? Math.round((data.employees.availableToday / data.employees.active) * 100) : 0

  const totalDelta: Delta | undefined = growth === undefined ? undefined : { percent: growth, versus: 'last month', upIsGood: true }
  const leaveDelta: Delta | undefined = leaveChange === undefined ? undefined : { percent: leaveChange, versus: 'a week ago', upIsGood: null }

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <StatTile
        label="Total employees"
        value={data.employees.total}
        icon={Users}
        tint="blue"
        delta={totalDelta}
        detail={newThisMonth > 0 ? `+${newThisMonth} new this month` : `${data.employees.active} active · ${data.employees.inactive} inactive`}
        to="/employees"
      />
      <StatTile
        label="On leave today"
        value={leave.onLeaveToday}
        icon={CalendarClock}
        tint="teal"
        delta={leaveDelta}
        detail={`${plural(leave.onLeaveLastWeek, 'person', 'people')} a week ago`}
        to="/leaves?status=APPROVED"
      />
      <StatTile
        label="Available today"
        value={data.employees.availableToday}
        icon={UserCheck}
        tint="violet"
        detail={`${availableShare}% of active staff, not on leave`}
        to="/employees?status=ACTIVE"
      />
      <StatTile
        label="Pending approvals"
        value={leave.pending}
        icon={Hourglass}
        tint="orange"
        detail={leave.pending === 0 ? 'Nothing waiting' : 'Leave requests to decide'}
        to="/leaves?status=PENDING"
      />
    </div>
  )
}

function GrowthPanel({ data }: { data: DashboardSummary }) {
  const [asTable, setAsTable] = useState(false)
  const points = data.headcountByMonth
  const empty = points.every((point) => point.total === 0)

  return (
    <Panel
      title="Employee growth"
      subtitle={`Total employees by the end of each of the last ${points.length} months`}
      aside={
        !empty && (
          <button
            type="button"
            onClick={() => setAsTable((value) => !value)}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50"
          >
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        )
      }
    >
      {empty ? (
        <EmptyNote>The chart appears once employees have been added.</EmptyNote>
      ) : (
        <>
          {asTable ? <GrowthTable points={points} /> : <GrowthChart points={points} />}
          <p className="mt-2 text-xs text-slate-500">Counts everyone hired by then. People who have left are not taken off, because the system does not record when someone leaves.</p>
        </>
      )}
    </Panel>
  )
}

function RecentEmployees({ rows }: { rows: DashboardSummary['recentEmployees'] }) {
  return (
    <Panel title="Recent employees" action={{ to: '/employees?sortBy=hireDate&direction=desc', label: 'View all' }}>
      {rows.length === 0 ? (
        <EmptyNote>
          Nobody has been added yet. <Link to="/employees?new=1" className="font-medium text-brand-700 hover:underline">Add an employee.</Link>
        </EmptyNote>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th scope="col" className="rounded-l-lg px-3 py-2.5">Name</th>
                <th scope="col" className="hidden px-3 py-2.5 sm:table-cell">Department</th>
                <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Province</th>
                <th scope="col" className="hidden px-3 py-2.5 sm:table-cell">Joined</th>
                <th scope="col" className="rounded-r-lg px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ person, email, department, province, hireDate, status }) => (
                <tr key={person.id}>
                  <td className="px-3 py-2.5">
                    <Link to={`/employees?q=${encodeURIComponent(email)}`} className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-brand-600">
                      <Avatar firstName={person.firstName} lastName={person.lastName} photoUrl={person.photoUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{email}</span>
                        <span className="block text-xs text-slate-500 sm:hidden">Joined {formatDate(hireDate)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-slate-700 sm:table-cell">{department ?? '—'}</td>
                  <td className="hidden px-3 py-2.5 text-slate-700 lg:table-cell">{province ?? '—'}</td>
                  <td className="hidden px-3 py-2.5 whitespace-nowrap text-slate-700 sm:table-cell">{formatDate(hireDate)}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={status === 'ACTIVE' ? 'green' : 'slate'}>{status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function UpcomingLeave({ rows, todayIso }: { rows: DashboardSummary['upcomingLeave']; todayIso: string }) {
  return (
    <Panel title="Upcoming leave" action={{ to: '/leaves?status=APPROVED', label: 'View all' }}>
      {rows.length === 0 ? (
        <EmptyNote>No approved leave is coming up.</EmptyNote>
      ) : (
        <ul className="space-y-1">
          {rows.map((leave) => {
            const days = daysBetween(leave.startDate, leave.endDate)
            const underway = leave.startDate <= todayIso
            return (
              <li key={leave.id}>
                <Link to="/leaves?status=APPROVED" className="flex items-center gap-3 rounded-lg px-1.5 py-2 hover:bg-slate-50">
                  <Avatar firstName={leave.employee.firstName} lastName={leave.employee.lastName} photoUrl={leave.employee.photoUrl} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {leave.employee.firstName} {leave.employee.lastName}
                    </span>
                    <span className="block text-xs text-slate-600">{leaveTypeLabel(leave.type)} leave{underway && ' · on leave now'}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDate(leave.startDate)}
                      {leave.endDate !== leave.startDate && ` – ${formatDate(leave.endDate)}`}
                    </span>
                  </span>
                  <Badge tone={underway ? 'green' : 'brand'}>{plural(days, 'day')}</Badge>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

const quickActions: { to: string; label: string; icon: LucideIcon; tint: string }[] = [
  { to: '/employees?new=1', label: 'Add employee', icon: UserPlus, tint: 'bg-brand-50 text-brand-700 hover:bg-brand-100' },
  { to: '/leaves?new=1', label: 'New leave request', icon: CalendarPlus, tint: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { to: '/trainings?new=1', label: 'New training', icon: GraduationCap, tint: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { to: '/departments?new=1', label: 'New department', icon: Building2, tint: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
]

/** Shortcuts that open the "new ..." form of each list. */
function QuickActions() {
  return (
    <Panel title="Quick actions" aside={<Zap aria-hidden className="size-4 text-brand-600" />}>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map(({ to, label, icon: Icon, tint }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${tint}`}
          >
            <Icon aria-hidden className="size-6" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </div>
    </Panel>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</p>
}
