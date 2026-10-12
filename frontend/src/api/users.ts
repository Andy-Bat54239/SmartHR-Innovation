import { api } from './client'
import type { AccountCreated, CreateAccountInput, UpdateAccountInput, UserAccount } from './types'

export const listUsers = () => api.get<UserAccount[]>('/user/search-all').then((r) => r.data)

/** The answer holds a generated temporary password, shown once. */
export const createUser = (input: CreateAccountInput) => api.post<AccountCreated>('/user/create', input).then((r) => r.data)

export const updateUser = (id: string, input: UpdateAccountInput) => api.put<UserAccount>(`/user/${id}`, input).then((r) => r.data)

/** New temporary password, shown once; the person is signed out everywhere. */
export const resetPassword = (id: string) => api.post<AccountCreated>(`/user/${id}/reset-password`).then((r) => r.data)

export const deleteUser = (id: string) => api.delete(`/user/${id}`).then(() => undefined)

/** Removes someone's two-factor sign-in (lost phone) and signs them out everywhere. */
export const resetTwoFactor = (id: string) => api.post<UserAccount>(`/user/${id}/reset-two-factor`).then((r) => r.data)
