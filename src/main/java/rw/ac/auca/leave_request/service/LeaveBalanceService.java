package rw.ac.auca.leave_request.service;

import rw.ac.auca.leave_request.domain.LeaveType;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface LeaveBalanceService {

    /** The year asked for, or this year when none is given (400 for a year outside 2000 to 2100). */
    static int yearOrCurrent(Integer year) {
        if (year == null) return LocalDate.now().getYear();
        if (year < 2000 || year > 2100) throw new IllegalArgumentException("year must be between 2000 and 2100");
        return year;
    }

    /** One balance per kind of leave for that employee and calendar year (404 for an unknown employee). */
    List<LeaveBalance> balances(UUID employeeId, int year);

    /**
     * Refuses (400 on "type") a request that asks for more working days than are left in any year it touches.
     * {@code ignoring} is the request being edited, so it does not count against itself (null for a new one).
     */
    void ensureEnough(UUID employeeId, LeaveType type, LocalDate start, LocalDate end, UUID ignoring);
}
