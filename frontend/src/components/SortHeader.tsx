interface SortHeaderProps {
  label: string
  /** the API field this column sorts by */
  field: string
  activeField: string
  direction: 'asc' | 'desc'
  onSort: (field: string) => void
}

/** A table heading that sorts by its column when clicked, and announces the order to screen readers. */
export function SortHeader({ label, field, activeField, direction, onSort }: SortHeaderProps) {
  const active = activeField === field
  return (
    <th scope="col" aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3">
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 font-semibold tracking-wide uppercase hover:text-slate-800">
        {label}
        <span aria-hidden className={active ? 'text-brand-600' : 'text-slate-300'}>
          {active && direction === 'desc' ? '↓' : '↑'}
        </span>
      </button>
    </th>
  )
}
