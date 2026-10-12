import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listChildren, listProvinces } from '../api/locations'
import { LOCATION_TYPES } from '../api/types'
import type { Location, LocationType } from '../api/types'
import { locationChain, typeLabel } from '../lib/location'

interface LocationPickerProps {
  /** the location already chosen (an employee being edited), used to pre-select the whole path */
  initial: Location | null
  /** called with the deepest level chosen, or null when nothing is chosen */
  onChange: (locationId: string | null) => void
  error?: string
}

const selectStyles =
  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-400'

/**
 * Province → District → Sector → Cell → Village, one dropdown per level. A level appears once its parent
 * is chosen and lists only that parent's children. Stopping early is fine (an employee may live at sector level).
 */
export function LocationPicker({ initial, onChange, error }: LocationPickerProps) {
  // path[i] is the id chosen at level i; its length is how deep the choice goes
  const [path, setPath] = useState<string[]>(() => locationChain(initial).map((l) => l.id))

  function choose(level: number, id: string) {
    const next = path.slice(0, level) // choosing a level forgets everything below it
    if (id) next.push(id)
    setPath(next)
    onChange(next.length > 0 ? next[next.length - 1] : null)
  }

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-slate-700">Location</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOCATION_TYPES.map((type, level) =>
          // a level shows up once the one above it has a choice
          level === 0 || path[level - 1] ? (
            <LevelSelect
              key={type}
              type={type}
              parentId={level === 0 ? null : path[level - 1]}
              value={path[level] ?? ''}
              onChange={(id) => choose(level, id)}
            />
          ) : null,
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}

function LevelSelect({
  type,
  parentId,
  value,
  onChange,
}: {
  type: LocationType
  parentId: string | null
  value: string
  onChange: (id: string) => void
}) {
  // same cache keys as the Locations page, so the lists are shared
  const options = useQuery({
    queryKey: parentId ? ['locations', 'children', parentId] : ['locations', 'provinces'],
    queryFn: () => (parentId ? listChildren(parentId) : listProvinces()),
  })

  const places = [...(options.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const label = typeLabel(type)
  const empty = options.isSuccess && places.length === 0

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <select
        aria-label={label}
        value={value}
        disabled={options.isPending || options.isError || empty}
        onChange={(e) => onChange(e.target.value)}
        className={selectStyles}
      >
        <option value="">
          {options.isPending ? 'Loading…' : options.isError ? 'Could not load' : empty ? `No ${label.toLowerCase()}s yet` : `Select ${label.toLowerCase()}…`}
        </option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>
    </div>
  )
}
