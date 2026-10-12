package rw.ac.auca.leave_request.service;

import rw.ac.auca.leave_request.domain.LeaveType;

/**
 * One kind of leave for one employee in one calendar year, counted in working days (Monday to Friday).
 * {@code allowance} and {@code remaining} are null for a type without a limit. Pending requests already
 * count against {@code remaining}, so the same days cannot be asked for twice.
 */
public record LeaveBalance(LeaveType type, int year, Integer allowance, int approved, int pending, Integer remaining) {
}
