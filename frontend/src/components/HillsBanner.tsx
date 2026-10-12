/** A wide picture of rolling green hills with a three-line motto over it. Decoration only, so it is hidden from screen readers. */
export function HillsBanner({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`relative overflow-hidden rounded-2xl shadow-card ${className}`}>
      <svg viewBox="0 0 420 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="hills-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fd3e6" />
            <stop offset="1" stopColor="#e6f4ea" />
          </linearGradient>
        </defs>
        <rect width="420" height="120" fill="url(#hills-sky)" />
        <circle cx="318" cy="38" r="15" fill="#fff6d6" fillOpacity="0.95" />
        <circle cx="318" cy="38" r="26" fill="#fff6d6" fillOpacity="0.28" />
        <path d="M0 78c40-22 72-26 112-12s70 16 108-4 84-26 120-10 54 8 80-4v72H0z" fill="#79bda9" />
        <path d="M0 92c36-14 70-18 108-6s66 10 104-2 88-22 132-8 52 6 76-2v46H0z" fill="#3f9b84" />
        <path d="M0 106c44-10 84-12 126-4s82 6 128-4 96-8 166 2v20H0z" fill="#1d6f5f" />
      </svg>
      <div className="absolute inset-0 bg-linear-to-r from-navy-900/85 via-navy-900/45 to-transparent" />
      <div className="relative px-5 py-4 text-white">
        <p className="text-lg leading-snug font-semibold tracking-tight">
          Better People
          <br />
          Stronger Teams
          <br />A Brighter Future
        </p>
        <span className="mt-2 block h-0.5 w-5 rounded bg-brand-300" />
      </div>
    </div>
  )
}
