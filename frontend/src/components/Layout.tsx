import {
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Menu,
  ScrollText,
  Search,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStackedTables } from '../hooks/useStackedTables'
import { Hills } from './Hills'
import { Logo } from './Logo'
import { MyNotificationBell } from './MyNotificationBell'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** match the address exactly (for "/", which every address starts with) */
  end?: boolean
}

// Pages are added here as they are built. (Locations has no entry: places only matter as an employee's address,
// which the employee form handles. The page is still there at /locations for adding cells and villages.)
const manage: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/departments', label: 'Departments', icon: Building2 },
  { to: '/leaves', label: 'Leave requests', icon: CalendarDays },
  { to: '/trainings', label: 'Trainings', icon: GraduationCap },
]
const administer: NavItem[] = [
  { to: '/users', label: 'Accounts', icon: UserCog },
  { to: '/audit', label: 'Audit log', icon: ScrollText },
]
const mine: NavItem[] = [
  { to: '/me', label: 'My profile', icon: UserRound },
  { to: '/my-leave', label: 'My leave', icon: CalendarCheck },
  { to: '/my-trainings', label: 'My trainings', icon: BookOpen },
]

function NavGroup({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate: () => void }) {
  return (
    <div className="space-y-1">
      {title && <p className="px-3 pt-5 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{title}</p>}
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
              isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}

/** Searches the employee list; the list page reads the text from the address. */
function EmployeeSearch() {
  const navigate = useNavigate()
  const [text, setText] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const query = text.trim()
    navigate(query ? `/employees?q=${encodeURIComponent(query)}` : '/employees')
    setText('')
  }

  return (
    <form onSubmit={submit} role="search" className="relative max-w-xl flex-1">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label="Search employees"
        placeholder="Search employees by name, email or phone"
        className="w-full rounded-xl border-0 bg-slate-100 py-2.5 pr-3 pl-10 text-sm text-slate-900 ring-1 ring-transparent ring-inset placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
      />
    </form>
  )
}

export function Layout() {
  const { user, hasRole, signOut } = useAuth()
  const runsHr = hasRole('HR', 'ADMIN')
  // everybody with a linked employee record can use the self-service pages (an EMPLOYEE account always has one)
  const hasEmployee = user?.employee != null
  const displayName = user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : (user?.username ?? '')

  // on a phone the tables turn into cards
  const main = useRef<HTMLElement>(null)
  useStackedTables(main)

  // on a phone the menu slides over the page
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className="min-h-screen md:flex">
      {/* lets keyboard users jump past the navigation */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:shadow-lg"
      >
        Skip to content
      </a>

      {menuOpen && <div aria-hidden onClick={closeMenu} className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" />}

      <aside
        id="side-menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-linear-to-b from-navy-900 to-navy-800 transition-[transform,visibility] duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:shrink-0 ${
          menuOpen ? '' : 'max-md:invisible max-md:-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Logo />
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Close the menu"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <nav aria-label="Main" className="relative z-10 flex-1 overflow-y-auto px-3 pb-4">
          {runsHr && <NavGroup items={manage} onNavigate={closeMenu} />}
          {hasRole('ADMIN') && <NavGroup title="Administration" items={administer} onNavigate={closeMenu} />}
          {hasEmployee && <NavGroup title={runsHr ? 'My space' : undefined} items={mine} onNavigate={closeMenu} />}
        </nav>

        <div className="relative z-10 px-6 pb-6 text-xs text-slate-300">
          <p>Great companies</p>
          <p>build great people.</p>
          <span className="mt-2 block h-0.5 w-5 rounded bg-brand-400" />
        </div>
        <Hills />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open the menu"
            aria-expanded={menuOpen}
            aria-controls="side-menu"
            className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>

          {runsHr ? <EmployeeSearch /> : <div className="flex-1" />}

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {runsHr ? <NotificationBell /> : hasEmployee && <MyNotificationBell />}
            {user && <UserMenu user={user} displayName={displayName} onSignOut={signOut} />}
          </div>
        </header>

        <main ref={main} id="main" tabIndex={-1} className="px-4 py-6 outline-none sm:px-8 sm:py-8">
          <div className="mx-auto max-w-[84rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
