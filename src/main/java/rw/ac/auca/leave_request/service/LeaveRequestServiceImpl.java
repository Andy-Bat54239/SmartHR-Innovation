package rw.ac.auca.leave_request.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import rw.ac.auca.notification.NotificationEvents;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.exception.FieldValidationException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.domain.LeaveType;
import rw.ac.auca.leave_request.repository.LeaveRequestRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class LeaveRequestServiceImpl implements LeaveRequestService {

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AuditService audit;

    @Autowired
    private LeaveBalanceService balances;

    @Autowired
    private ApplicationEventPublisher events;

    @Override
    @Transactional
    public LeaveRequest registerLeaveRequest(LeaveRequest leaveRequest) {
        checkDates(leaveRequest.getStartDate(), leaveRequest.getEndDate());
        leaveRequest.setEmployee(resolveEmployee(leaveRequest.getEmployee()));
        balances.ensureEnough(leaveRequest.getEmployee().getId(), leaveRequest.getType(), leaveRequest.getStartDate(),
                leaveRequest.getEndDate(), null);
        // A new request always starts as PENDING, whatever the client sent
        leaveRequest.setStatus(LeaveStatus.PENDING);
        leaveRequest.setRejectionReason(null);
        LeaveRequest saved = leaveRequestRepository.save(leaveRequest);
        audit.created(AuditEntity.LEAVE_REQUEST, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        events.publishEvent(new NotificationEvents.LeaveSubmitted(saved.getEmployee().getId(), name(saved.getEmployee()), saved.getType(),
                saved.getStartDate(), saved.getEndDate(), saved.getReason()));
        return saved;
    }

    @Override
    @Transactional
    public LeaveRequest updateLeaveRequest(LeaveRequest leaveRequest) {
        LeaveRequest found = findLeaveRequestById(leaveRequest);
        if (found.getStatus() != LeaveStatus.PENDING) {
            throw new IllegalStateException("Only a PENDING leave request can be edited");
        }
        checkDates(leaveRequest.getStartDate(), leaveRequest.getEndDate());
        balances.ensureEnough(found.getEmployee().getId(), leaveRequest.getType(), leaveRequest.getStartDate(),
                leaveRequest.getEndDate(), found.getId());
        AuditSnapshot before = AuditSnapshots.of(found);
        // Status changes only through approve/reject, and the owner never changes
        found.setStartDate(leaveRequest.getStartDate());
        found.setEndDate(leaveRequest.getEndDate());
        found.setReason(leaveRequest.getReason());
        found.setType(leaveRequest.getType());
        LeaveRequest saved = leaveRequestRepository.save(found);
        audit.updated(AuditEntity.LEAVE_REQUEST, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public void deleteLeaveRequest(LeaveRequest leaveRequest) {
        LeaveRequest found = findLeaveRequestById(leaveRequest);
        AuditSnapshot snapshot = AuditSnapshots.of(found);
        String label = AuditSnapshots.label(found);
        leaveRequestRepository.delete(found);
        audit.deleted(AuditEntity.LEAVE_REQUEST, found.getId(), label, snapshot, null);
    }

    @Override
    @Transactional(readOnly = true)
    public LeaveRequest findLeaveRequestById(LeaveRequest leaveRequest) {
        return leaveRequestRepository.findById(leaveRequest.getId())
                .orElseThrow(() -> new ResourceNotFoundException("LeaveRequest", leaveRequest.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequest> findAllLeaveRequests() {
        return leaveRequestRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LeaveRequest> searchLeaveRequests(LeaveFilter filter, Pageable pageable) {
        Specification<LeaveRequest> spec = (root, query, cb) -> cb.conjunction();
        if (filter.status() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), filter.status()));
        }
        if (filter.type() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("type"), filter.type()));
        }
        if (filter.employeeId() != null) {
            if (!employeeRepository.existsById(filter.employeeId())) {
                throw new ResourceNotFoundException("Employee", filter.employeeId());
            }
            spec = spec.and((root, query, cb) -> cb.equal(root.get("employee").get("id"), filter.employeeId()));
        }
        return leaveRequestRepository.findAll(spec, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequest> findLeaveRequestsByEmployee(UUID employeeId) {
        if (!employeeRepository.existsById(employeeId)) {
            throw new ResourceNotFoundException("Employee", employeeId);
        }
        return leaveRequestRepository.findByEmployee_Id(employeeId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LeaveRequest> findLeaveRequestsByEmployee(UUID employeeId, Pageable pageable) {
        if (!employeeRepository.existsById(employeeId)) {
            throw new ResourceNotFoundException("Employee", employeeId);
        }
        return leaveRequestRepository.findByEmployee_Id(employeeId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequest> findLeaveRequestsByStatus(LeaveStatus status) {
        return leaveRequestRepository.findByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequest> findLeaveRequestsByType(LeaveType type) {
        return leaveRequestRepository.findByType(type);
    }

    @Override
    @Transactional
    public LeaveRequest approveLeaveRequest(UUID id, UUID decidedBy) {
        return decide(id, LeaveStatus.APPROVED, decidedBy, null);
    }

    @Override
    @Transactional
    public LeaveRequest rejectLeaveRequest(UUID id, UUID decidedBy, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new FieldValidationException("reason", "Give a reason for rejecting this request");
        }
        if (reason.strip().length() > 1000) {
            throw new FieldValidationException("reason", "Reason must be at most 1000 characters");
        }
        return decide(id, LeaveStatus.REJECTED, decidedBy, reason.strip());
    }

    @Override
    @Transactional
    public LeaveRequest updateOwnLeaveRequest(LeaveRequest leaveRequest, UUID employeeId) {
        loadOwn(leaveRequest.getId(), employeeId);   // someone else's request looks like a request that does not exist
        return updateLeaveRequest(leaveRequest);
    }

    @Override
    @Transactional
    public void withdrawOwnLeaveRequest(UUID id, UUID employeeId) {
        LeaveRequest own = loadOwn(id, employeeId);
        if (own.getStatus() != LeaveStatus.PENDING) {
            throw new IllegalStateException("Only a pending request can be withdrawn; this one is already " + own.getStatus());
        }
        audit.action(AuditAction.LEAVE_WITHDRAWN, AuditEntity.LEAVE_REQUEST, own.getId(), AuditSnapshots.label(own),
                "Withdrew leave request " + AuditSnapshots.label(own), null);
        leaveRequestRepository.delete(own);
    }

    private LeaveRequest loadOwn(UUID id, UUID employeeId) {
        return leaveRequestRepository.findById(id)
                .filter(leave -> leave.getEmployee().getId().equals(employeeId))
                .orElseThrow(() -> new ResourceNotFoundException("LeaveRequest", id));
    }

    /** PENDING is the only state that can be decided; a decision is final, and nobody decides their own request. */
    private LeaveRequest decide(UUID id, LeaveStatus decision, UUID decidedBy, String rejectionReason) {
        LeaveRequest found = leaveRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("LeaveRequest", id));
        if (decidedBy != null && decidedBy.equals(found.getEmployee().getId())) {
            throw new AccessDeniedException("You cannot decide your own leave request");
        }
        if (found.getStatus() != LeaveStatus.PENDING) {
            throw new IllegalStateException("Leave request is already " + found.getStatus());
        }
        found.setStatus(decision);
        found.setRejectionReason(rejectionReason);
        LeaveRequest saved = leaveRequestRepository.save(found);
        boolean approved = decision == LeaveStatus.APPROVED;
        audit.action(approved ? AuditAction.LEAVE_APPROVED : AuditAction.LEAVE_REJECTED, AuditEntity.LEAVE_REQUEST, saved.getId(),
                AuditSnapshots.label(saved), (approved ? "Approved" : "Rejected") + " leave request " + AuditSnapshots.label(saved), rejectionReason);
        events.publishEvent(new NotificationEvents.LeaveDecided(saved.getEmployee().getId(), name(saved.getEmployee()), approved, saved.getType(),
                saved.getStartDate(), saved.getEndDate(), rejectionReason));
        return saved;
    }

    private static String name(Employee employee) {
        return employee.getFirstName() + " " + employee.getLastName();
    }

    private Employee resolveEmployee(Employee reference) {
        if (reference == null || reference.getId() == null) {
            throw new FieldValidationException("employee", "Choose the employee this leave is for");
        }
        return employeeRepository.findById(reference.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", reference.getId()));
    }

    private void checkDates(LocalDate start, LocalDate end) {
        if (start == null) {
            throw new FieldValidationException("startDate", "Start date is required");
        }
        if (end == null) {
            throw new FieldValidationException("endDate", "End date is required");
        }
        if (end.isBefore(start)) {
            throw new FieldValidationException("endDate", "End date cannot be before start date");
        }
    }
}
