import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { listDepartments } from '../../api/departments'
import { createEmployee, updateEmployee } from '../../api/employees'
import { createProfile, deleteProfile, updateProfile } from '../../api/profiles'
import { EMPLOYEE_STATUSES, GENDERS } from '../../api/types'
import type { Employee, EmployeeStatus, Gender, ProfileInput } from '../../api/types'
import { Button } from '../../components/Button'
import { ErrorMessage } from '../../components/Feedback'
import { SelectField, TextField } from '../../components/Fields'
import { LocationPicker } from '../../components/LocationPicker'
import { useToast } from '../../hooks/useToast'
import { today } from '../../lib/dates'

interface EmployeeFormProps {
  /** the employee being edited, or undefined to create a new one */
  initial?: Employee
  onSaved: () => void
  onCancel: () => void
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

export function EmployeeForm({ initial, onSaved, onCancel }: EmployeeFormProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments })

  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [lastName, setLastName] = useState(initial?.lastName ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '')
  const [status, setStatus] = useState<EmployeeStatus>(initial?.status ?? 'ACTIVE')
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? today())
  const [departmentId, setDepartmentId] = useState(initial?.department?.id ?? '')
  const [locationId, setLocationId] = useState<string | null>(initial?.location?.id ?? null)

  const [nationalId, setNationalId] = useState(initial?.profile?.nationalId ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(initial?.profile?.dateOfBirth ?? '')
  const [educationLevel, setEducationLevel] = useState(initial?.profile?.educationLevel ?? '')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(initial?.profile?.profilePhotoUrl ?? '')

  const departmentOptions = useMemo(
    () =>
      [...(departments.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ value: d.id, label: d.name })),
    [departments.data],
  )

  const save = useMutation({
    /**
     * The API keeps the profile as its own record that an employee points to, so saving is two calls:
     *   1. create (or update) the profile, if the profile section is filled in
     *   2. create (or update) the employee, pointing at that profile
     * If step 2 fails after step 1 created a brand-new profile, that profile is removed again,
     * otherwise a retry would be refused with "national id already in use".
     */
    mutationFn: async () => {
      const profileFields: ProfileInput = {
        nationalId: nationalId.trim(),
        dateOfBirth: dateOfBirth || null,
        educationLevel: educationLevel.trim(),
        profilePhotoUrl: profilePhotoUrl.trim() || null,
      }
      const profileFilledIn = Boolean(
        profileFields.nationalId || profileFields.dateOfBirth || profileFields.educationLevel || profileFields.profilePhotoUrl,
      )

      let profileId = initial?.profile?.id ?? null
      let createdProfileId: string | null = null
      if (profileFilledIn) {
        if (profileId) {
          await updateProfile(profileId, profileFields)
        } else {
          profileId = (await createProfile(profileFields)).id
          createdProfileId = profileId
        }
      }

      const employeeInput = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender: gender || null,
        hireDate: hireDate || null,
        status,
        department: departmentId ? { id: departmentId } : null,
        location: locationId ? { id: locationId } : null,
        profile: profileId ? { id: profileId } : null,
      }
      try {
        return initial ? await updateEmployee(initial.id, employeeInput) : await createEmployee(employeeInput)
      } catch (error) {
        if (createdProfileId) {
          await deleteProfile(createdProfileId).catch(() => undefined)
        }
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      const name = `${firstName.trim()} ${lastName.trim()}`
      toast(initial ? `Saved changes to ${name}` : `Added ${name}`)
      onSaved()
    },
  })

  // The API reports problems per field (validation 400s and duplicate email / phone / national id 409s).
  // Employee and profile fields have different names, so one map serves both.
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const generalError = save.error && Object.keys(fieldErrors).length === 0 ? errorMessage(save.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  // noValidate: the API is the single source of truth for the rules, so its messages are shown
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {generalError && <ErrorMessage message={generalError} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={fieldErrors.firstName} autoFocus />
        <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={fieldErrors.lastName} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} />
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fieldErrors.phone}
          placeholder="+250788123456"
        />
        <SelectField
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender | '')}
          error={fieldErrors.gender}
          placeholder="Select…"
          options={GENDERS.map((g) => ({ value: g, label: titleCase(g) }))}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
          error={fieldErrors.status}
          options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
        />
        <TextField label="Hire date" type="date" max={today()} value={hireDate} onChange={(e) => setHireDate(e.target.value)} error={fieldErrors.hireDate} />
        <SelectField
          label="Department"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          placeholder={departments.isPending ? 'Loading…' : 'No department'}
          options={departmentOptions}
          disabled={departments.isPending}
        />
      </div>

      <LocationPicker initial={initial?.location ?? null} onChange={setLocationId} />

      <fieldset className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Extended profile (optional)</legend>
        <p className="mb-3 text-xs text-slate-500">Leave empty to add it later. Once you start, the national ID, date of birth and education are required.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="National ID"
            inputMode="numeric"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            error={fieldErrors.nationalId}
            placeholder="16 digits"
          />
          <TextField label="Date of birth" type="date" max={today()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} error={fieldErrors.dateOfBirth} />
          <TextField label="Education level" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} error={fieldErrors.educationLevel} placeholder="e.g. Bachelor" />
          <TextField label="Photo URL" type="url" value={profilePhotoUrl} onChange={(e) => setProfilePhotoUrl(e.target.value)} error={fieldErrors.profilePhotoUrl} />
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Create employee'}
        </Button>
      </div>
    </form>
  )
}
