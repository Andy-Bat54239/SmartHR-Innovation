import { LOCATION_TYPES } from '../api/types'
import type { Location, LocationType } from '../api/types'

/** The location and its parents, province first. */
export function locationChain(location: Location | null): Location[] {
  const chain: Location[] = []
  for (let current = location; current; current = current.parent) {
    chain.unshift(current)
  }
  return chain
}

/** "Kigali City › Gasabo › Kimironko" */
export function locationPath(location: Location | null, separator = ' › '): string {
  return locationChain(location)
    .map((l) => l.name)
    .join(separator)
}

/** The type one level down, or null for a village (nothing lives below it). */
export function childType(type: LocationType): LocationType | null {
  return LOCATION_TYPES[LOCATION_TYPES.indexOf(type) + 1] ?? null
}

/** "Province", "District"... for display. */
export function typeLabel(type: LocationType): string {
  return type.charAt(0) + type.slice(1).toLowerCase()
}
