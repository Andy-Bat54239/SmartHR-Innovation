import type { LeaveBalance } from '../api/types'
import { leaveTypeLabel } from '../lib/leave'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** How much of each kind of leave is left this year: the number left, a bar of what is used, and the detail. */
export function LeaveBalanceCards({ balances }: { balances: LeaveBalance[] }) {
  const year = balances[0]?.year
  return (
    <section aria-label={`Leave balance ${year ?? ''}`} className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        Your leave balance{year ? ` for ${year}` : ''} <span className="font-normal text-slate-500">(working days, Monday to Friday)</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {balances.map((balance) => {
          const { allowance, remaining } = balance
          const limited = allowance !== null && remaining !== null
          const usedShare = limited && allowance > 0 ? Math.min(100, (balance.approved / allowance) * 100) : 0
          const pendingShare = limited && allowance > 0 ? Math.min(100 - usedShare, (balance.pending / allowance) * 100) : 0
          const low = limited && remaining <= Math.ceil(allowance * 0.15)
          return (
            <div key={balance.type} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{leaveTypeLabel(balance.type)} leave</p>
              {limited ? (
                <>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className={`text-3xl font-semibold tracking-tight ${remaining <= 0 ? 'text-red-700' : low ? 'text-amber-700' : 'text-slate-900'}`}>
                      {Math.max(remaining, 0)}
                    </span>
                    <span className="text-sm text-slate-500">of {allowance} left</span>
                  </p>
                  <div
                    role="img"
                    aria-label={`${days(balance.approved)} taken, ${days(balance.pending)} waiting, ${days(Math.max(remaining, 0))} left of ${allowance}`}
                    className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100"
                  >
                    <span className="bg-brand-600" style={{ width: `${usedShare}%` }} />
                    <span className="bg-amber-400" style={{ width: `${pendingShare}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {balance.approved} taken · {balance.pending} waiting for a decision
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">No limit</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {balance.approved} taken · {balance.pending} waiting for a decision
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
