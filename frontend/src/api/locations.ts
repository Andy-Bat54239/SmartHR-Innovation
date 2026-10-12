import { api } from './client'
import type { Location, LocationInput } from './types'

export const listProvinces = () => api.get<Location[]>('/location/type/PROVINCE').then((r) => r.data)

export const listChildren = (parentId: string) =>
  api.get<Location[]>(`/location/${parentId}/children`).then((r) => r.data)

/** One location, with its parents up to the province. */
export const getLocation = (id: string) => api.get<Location>(`/location/search/${id}`).then((r) => r.data)

export const createLocation = (input: LocationInput) =>
  api.post<Location>('/location/create', input).then((r) => r.data)

export const updateLocation = (id: string, input: LocationInput) =>
  api.put<Location>(`/location/${id}`, input).then((r) => r.data)

/** Also deletes everything below it; employees there keep existing but lose their location. */
export const deleteLocation = (id: string) => api.delete(`/location/${id}`).then(() => undefined)
