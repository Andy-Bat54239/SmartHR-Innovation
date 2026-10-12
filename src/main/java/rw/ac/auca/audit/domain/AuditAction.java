package rw.ac.auca.audit.domain;

/** What happened. The CREATED / UPDATED / DELETED trio covers ordinary records; accounts and workflow steps have their own. */
public enum AuditAction {
    // ordinary records (employees, departments, ...)
    CREATED,
    UPDATED,
    DELETED,
    // workflow steps on leave requests and trainings
    LEAVE_APPROVED,
    LEAVE_REJECTED,
    LEAVE_WITHDRAWN,
    TRAINING_ENROLLED,
    TRAINING_REMOVED,
    // accounts
    ACCOUNT_CREATED,
    ACCOUNT_UPDATED,
    ACCOUNT_DELETED,
    PASSWORD_RESET,
    PASSWORD_CHANGED,
    // signing in
    SIGNED_IN,
    SIGN_IN_FAILED
}
