package rw.ac.auca.base;

/**
 * Bean Validation group for rules that apply only when a record is created, not when it is updated
 * (for example a leave request names its employee once; later edits never resend it).
 */
public interface OnCreate {
}
