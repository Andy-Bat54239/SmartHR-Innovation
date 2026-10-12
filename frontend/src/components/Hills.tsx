/** Soft hills along the bottom of a dark panel. Decoration only. */
export function Hills({ className = 'h-28' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 256 120" preserveAspectRatio="none" className={`pointer-events-none absolute inset-x-0 bottom-0 w-full ${className}`}>
      <path d="M0 120V62c30-18 56-24 84-12s52 22 82 4 60-30 90-14v80z" fill="#15a096" fillOpacity="0.14" />
      <path d="M0 120V84c34-14 62-8 92 4s58 14 88-2 52-14 76-4v38z" fill="#15a096" fillOpacity="0.2" />
    </svg>
  )
}
