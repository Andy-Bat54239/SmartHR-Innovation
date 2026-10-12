package rw.ac.auca.leave_request.service;

import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.domain.LeaveType;

import java.util.UUID;

/** Optional filters of the leave request search. Every field may be null; the ones given are combined with AND. */
public record LeaveFilter(LeaveStatus status, LeaveType type, UUID employeeId) {
}
