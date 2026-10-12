/** The SmartHR mark: three people, the one in the middle a little ahead. */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="12" r="5" fill="#3fbcb0" />
      <path d="M11 29c0-5 4-8 9-8s9 3 9 8z" fill="#3fbcb0" />
      <circle cx="8.5" cy="15.5" r="3.4" fill="#15a096" />
      <path d="M2 28.5c0-3.8 2.8-6.1 6.5-6.2-1.6 1.6-2.5 3.7-2.7 6.2z" fill="#15a096" />
      <circle cx="31.5" cy="15.5" r="3.4" fill="#15a096" />
      <path d="M38 28.5c0-3.8-2.8-6.1-6.5-6.2 1.6 1.6 2.5 3.7 2.7 6.2z" fill="#15a096" />
    </svg>
  )
}

/** The mark with the name and the three words under it, for the dark side menu. */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <p className="text-xl font-semibold tracking-tight text-white">SmartHR</p>
        {/* there is no room for it beside the close button on a phone */}
        <p className="hidden text-[11px] text-slate-300 md:block">People · Process · Progress</p>
      </div>
    </div>
  )
}
