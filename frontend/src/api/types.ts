// Shapes returned by the SmartHR API (see the README at the repository root).

/** Fields every record has (BaseEntity). Ids are UUIDs, timestamps are ISO strings. */
export interface BaseRecord {
  id: string
  createdAt: string
  updatedAt: string
}

// ---- enums (the API sends their names) ----

/** Ordered top-down: the index is the depth in the hierarchy. */
export const LOCATION_TYPES = ['PROVINCE', 'DISTRICT', 'SECTOR', 'CELL', 'VILLAGE'] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const
export type Gender = (typeof GENDERS)[number]

export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const ROLES = ['ADMIN', 'HR', 'EMPLOYEE'] as const
export type Role = (typeof ROLES)[number]

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPAID'] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

// ---- departments ----

export interface Department extends BaseRecord {
  name: string
  code: string
  description: string | null
}

/** What the department form sends. */
export interface DepartmentInput {
  name: string
  code: string
  description: string | null
}

// ---- locations ----

/** The API includes the whole chain of parents, so a location knows its own path up to the province. */
export interface Location extends BaseRecord {
  name: string
  type: LocationType
  code: string | null
  parent: Location | null
}

export interface LocationInput {
  name: string
  type: LocationType
  code: string | null
  /** required for everything except a province; ignored on update */
  parent?: { id: string } | null
}

// ---- employees and their profile ----

export interface EmployeeProfile extends BaseRecord {
  nationalId: string
  dateOfBirth: string
  educationLevel: string
  profilePhotoUrl: string | null
}

export interface ProfileInput {
  nationalId: string
  dateOfBirth: string | null
  educationLevel: string
  profilePhotoUrl: string | null
}

export interface Employee extends BaseRecord {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: Gender
  hireDate: string
  status: EmployeeStatus
  department: Department | null
  location: Location | null
  profile: EmployeeProfile | null
}

/**
 * What the employee form sends. Related records are referenced by id only.
 * gender / hireDate may be null so that the API, not the form, reports them as missing.
 */
export interface EmployeeInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: Gender | null
  hireDate: string | null
  status: EmployeeStatus
  department: { id: string } | null
  location: { id: string } | null
  profile: { id: string } | null
}

// ---- leave requests ----

export interface LeaveRequest extends BaseRecord {
  startDate: string
  endDate: string
  reason: string | null
  /** why HR or an administrator rejected it; only set when `status` is REJECTED */
  rejectionReason: string | null
  status: LeaveStatus
  type: LeaveType
  employee: Employee
}

/** One kind of leave in one calendar year, in working days (Monday to Friday). `allowance` and `remaining` are null when there is no limit. */
export interface LeaveBalance {
  type: LeaveType
  year: number
  allowance: number | null
  approved: number
  /** pending requests already count against `remaining` */
  pending: number
  remaining: number | null
}

/** What the leave form sends. `employee` is needed to create a request and ignored when updating one. */
export interface LeaveInput {
  startDate: string | null
  endDate: string | null
  type: LeaveType | null
  reason: string | null
  employee?: { id: string } | null
}

// ---- trainings ----

export interface Training extends BaseRecord {
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  trainer: string | null
}

export interface TrainingInput {
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  trainer: string | null
}

// ---- dashboard ----

/** One bar of a headcount chart. `id` is null for the "nobody assigned" bar. */
export interface GroupCount {
  id: string | null
  name: string
  count: number
}

/** Just enough of an employee to show a name and a picture. */
export interface Person {
  id: string
  firstName: string
  lastName: string
  photoUrl: string | null
}

export interface DashboardSummary {
  /** `availableToday`: active employees who are not on approved leave today */
  employees: { total: number; active: number; inactive: number; availableToday: number }
  /** every department (empty ones too), biggest first, then "No department" */
  byDepartment: GroupCount[]
  /** every province (empty ones too), biggest first, then "No location" */
  byProvince: GroupCount[]
  /** `pending` waits for a decision; `onLeaveToday` is how many people have approved leave covering today (`onLeaveLastWeek`: a week ago) */
  leave: { pending: number; onLeaveToday: number; onLeaveLastWeek: number }
  trainings: { ongoing: number; upcoming: number; completed: number; unscheduled: number }
  /** the last six months, oldest first: how many people had been hired by the end of each ("2026-05"; the current month: up to today) */
  headcountByMonth: { month: string; total: number }[]
  /** approved leave that is under way or still to come, soonest first (at most five) */
  upcomingLeave: { id: string; employee: Person; type: LeaveType; startDate: string; endDate: string }[]
  /** the newest hires first (at most five) */
  recentEmployees: { person: Person; email: string; department: string | null; province: string | null; hireDate: string; status: EmployeeStatus }[]
}

// ---- accounts and sign-in ----

/** A login as the API shows it. It never contains a password. */
export interface UserAccount {
  id: string
  username: string
  role: Role
  enabled: boolean
  /** true while the password is one an administrator set: it must be replaced before anything else works */
  mustChangePassword: boolean
  /** signing in also needs a code from an authenticator app */
  twoFactorEnabled: boolean
  /** the role must use two-factor sign-in and has not set it up: only the security page works until it does */
  twoFactorSetupRequired: boolean
  /** emails about leave requests and trainings are on (security alerts are always sent) */
  emailNotifications: boolean
  employee: { id: string; firstName: string; lastName: string } | null
  createdAt: string
}

export interface LoginResponse {
  token: string
  expiresAt: string
  user: UserAccount
}

/** The answer to a correct password for an account with two-factor sign-in: finish with the code at `/auth/login/2fa`. */
export interface TwoFactorChallenge {
  twoFactorRequired: true
  challengeToken: string
}

export interface TwoFactorStatus {
  enabled: boolean
  required: boolean
  recoveryCodesLeft: number
}

export interface TwoFactorSetup {
  /** the Base32 secret, to type in when the QR code cannot be scanned */
  secret: string
  /** what the QR code holds */
  otpauthUri: string
}

/** Returned when an account is created or its password is reset: the temporary password is shown this once. */
export interface AccountCreated {
  user: UserAccount
  temporaryPassword: string
}

export interface CreateAccountInput {
  username: string
  role: Role
  employeeId: string | null
}

export interface UpdateAccountInput {
  role: Role
  enabled: boolean
  employeeId: string | null
}

/** The signed-in account and, when it is linked to one, the employee record behind it. */
export interface Me {
  user: UserAccount
  employee: Employee | null
}

// ---- audit trail ----

export const AUDIT_ACTIONS = [
  'CREATED', 'UPDATED', 'DELETED',
  'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_WITHDRAWN', 'TRAINING_ENROLLED', 'TRAINING_REMOVED',
  'ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'ACCOUNT_DELETED', 'PASSWORD_RESET', 'PASSWORD_CHANGED',
  'SIGNED_IN', 'SIGN_IN_FAILED',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ENTITIES = ['EMPLOYEE', 'PROFILE', 'DEPARTMENT', 'LOCATION', 'TRAINING', 'LEAVE_REQUEST', 'ACCOUNT'] as const
export type AuditEntityType = (typeof AUDIT_ENTITIES)[number]

/** One field of an event. `oldValue` is null for a new record, `newValue` for a deleted one; both are "(hidden)" for sensitive fields. */
export interface AuditChange {
  field: string
  oldValue: string | null
  newValue: string | null
}

export interface AuditEvent {
  id: string
  occurredAt: string
  /** a username, "system", or (for a failed sign-in) the username that was tried */
  actorUsername: string
  actorRole: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string | null
  /** the record's name at the time, kept after the record is deleted */
  entityLabel: string | null
  summary: string
  note: string | null
  ipAddress: string | null
  changes: AuditChange[]
}

// ---- generic ----

/** Body of every error response. `errors` is present for validation failures and single-field conflicts. */
export interface ApiErrorBody {
  timestamp: string
  status: number
  error: string
  message: string
  errors?: Record<string, string>
  /** a machine-readable reason, set for PASSWORD_CHANGE_REQUIRED */
  code?: string
  path: string
}

/** Response of every `.../search-page` endpoint. */
export interface Page<T> {
  content: T[]
  page: { size: number; number: number; totalElements: number; totalPages: number }
}
