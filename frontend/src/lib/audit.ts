import type { BadgeTone } from '../components/Badge'
import type { AuditAction, AuditEntityType } from '../api/types'

export const auditActionLabel: Record<AuditAction, string> = {
  CREATED: 'Created',
  UPDATED: 'Changed',
  DELETED: 'Deleted',
  LEAVE_APPROVED: 'Leave approved',
  LEAVE_REJECTED: 'Leave rejected',
  LEAVE_WITHDRAWN: 'Leave withdrawn',
  TRAINING_ENROLLED: 'Enrolled',
  TRAINING_REMOVED: 'Removed from training',
  ACCOUNT_CREATED: 'Account created',
  ACCOUNT_UPDATED: 'Account changed',
  ACCOUNT_DELETED: 'Account deleted',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_CHANGED: 'Password changed',
  SIGNED_IN: 'Signed in',
  SIGN_IN_FAILED: 'Sign-in failed',
}

/** Green for things that came into being or were approved, red for things that went away or were refused, amber for warnings. */
export const auditActionTone: Record<AuditAction, BadgeTone> = {
  CREATED: 'green',
  UPDATED: 'brand',
  DELETED: 'red',
  LEAVE_APPROVED: 'green',
  LEAVE_REJECTED: 'red',
  LEAVE_WITHDRAWN: 'slate',
  TRAINING_ENROLLED: 'brand',
  TRAINING_REMOVED: 'slate',
  ACCOUNT_CREATED: 'green',
  ACCOUNT_UPDATED: 'brand',
  ACCOUNT_DELETED: 'red',
  PASSWORD_RESET: 'amber',
  PASSWORD_CHANGED: 'slate',
  SIGNED_IN: 'slate',
  SIGN_IN_FAILED: 'amber',
}

export const auditEntityLabel: Record<AuditEntityType, string> = {
  EMPLOYEE: 'Employee',
  PROFILE: 'Profile',
  DEPARTMENT: 'Department',
  LOCATION: 'Location',
  TRAINING: 'Training',
  LEAVE_REQUEST: 'Leave request',
  ACCOUNT: 'Account',
}
