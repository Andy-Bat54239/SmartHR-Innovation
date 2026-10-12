import type { ReactNode } from 'react'
import { Hills } from './Hills'
import { Logo, LogoMark } from './Logo'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/** The frame of the pages people see before they are fully signed in: a dark brand panel beside a form (the form alone on a phone). */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-linear-to-b from-navy-900 to-navy-800 p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="relative z-10">
          <p className="text-4xl leading-tight font-semibold tracking-tight text-white">
            Better People
            <br />
            Stronger Teams
            <br />A Brighter Future
          </p>
          <span className="mt-5 block h-0.5 w-8 rounded bg-brand-400" />
          <p className="mt-5 max-w-sm text-sm text-slate-300">Employees, departments, leave and trainings across Rwanda, in one place.</p>
        </div>
        <p className="relative z-10 text-xs text-slate-300">Great companies build great people.</p>
        <Hills className="h-44" />
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center lg:text-left">
            <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-navy-900 lg:hidden">
              <LogoMark className="size-8" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
