package rw.ac.auca.leave_request.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.domain.LeaveType;

import java.util.List;
import java.util.UUID;

public interface LeaveRequestService {
    LeaveRequest registerLeaveRequest(LeaveRequest leaveRequest);
    LeaveRequest updateLeaveRequest(LeaveRequest leaveRequest);
    void deleteLeaveRequest(LeaveRequest leaveRequest);
    LeaveRequest findLeaveRequestById(LeaveRequest leaveRequest);
    List<LeaveRequest> findAllLeaveRequests();

    /** One page of leave requests matching every filter that is set (see {@link LeaveFilter}). */
    Page<LeaveRequest> searchLeaveRequests(LeaveFilter filter, Pageable pageable);
    List<LeaveRequest> findLeaveRequestsByEmployee(UUID employeeId);
    Page<LeaveRequest> findLeaveRequestsByEmployee(UUID employeeId, Pageable pageable);
    List<LeaveRequest> findLeaveRequestsByStatus(LeaveStatus status);
    List<LeaveRequest> findLeaveRequestsByType(LeaveType type);
    /** {@code decidedBy} is the employee making the decision (null when their account has none); nobody decides their own request. */
    LeaveRequest approveLeaveRequest(UUID id, UUID decidedBy);
    /** {@code reason} is required (not blank); it is stored on the request and shown to the employee. */
    LeaveRequest rejectLeaveRequest(UUID id, UUID decidedBy, String reason);

    /** Edits a request of that employee (404 if it is someone else's, 409 once it has been decided). */
    LeaveRequest updateOwnLeaveRequest(LeaveRequest leaveRequest, UUID employeeId);

    /** Deletes a request of that employee, only while it is still pending. */
    void withdrawOwnLeaveRequest(UUID id, UUID employeeId);
}
