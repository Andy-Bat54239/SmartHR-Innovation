import { ChevronDown, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { UserAccount } from '../api/types'
import { roleLabel } from '../lib/role'
import { Avatar } from './Avatar'

/** The name, role and picture in the corner; opens a small menu with the account actions. */
export function UserMenu({ user, displayName, onSignOut }: { user: UserAccount; displayName: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  // close on a click elsewhere or on Escape (and hand the focus back to the button)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const [first = '', ...rest] = displayName.split(' ')
  const last = rest.join(' ')

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-xl py-1 pr-2 pl-1 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Avatar firstName={first} lastName={last || first.slice(1)} size="md" />
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-slate-900">{displayName}</span>
          <span className="block text-xs text-slate-500">{roleLabel[user.role]}</span>
        </span>
        <ChevronDown aria-hidden className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id="user-menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500" title={user.username}>
              {user.username}
            </p>
          </div>
          <Link
            to="/security"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <ShieldCheck aria-hidden className="size-4 text-slate-400" /> Security
            {user.twoFactorSetupRequired && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Action needed</span>}
          </Link>
          <Link
            to="/change-password"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <KeyRound aria-hidden className="size-4 text-slate-400" /> Change password
          </Link>
          <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
            <LogOut aria-hidden className="size-4 text-slate-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
