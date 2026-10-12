package rw.ac.auca.leave_request.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.exception.FieldValidationException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.domain.LeaveType;
import rw.ac.auca.leave_request.repository.LeaveRequestRepository;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class LeaveBalanceServiceImpl implements LeaveBalanceService {

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private LeaveAllowanceProperties allowances;

    @Override
    @Transactional(readOnly = true)
    public List<LeaveBalance> balances(UUID employeeId, int year) {
        if (!employeeRepository.existsById(employeeId)) {
            throw new ResourceNotFoundException("Employee", employeeId);
        }
        List<LeaveRequest> counted = countedRequests(employeeId, year);
        return Arrays.stream(LeaveType.values()).map(type -> balance(type, year, counted, null)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public void ensureEnough(UUID employeeId, LeaveType type, LocalDate start, LocalDate end, UUID ignoring) {
        if (type == null || start == null || end == null || allowances.allowanceFor(type) == null) {
            return;
        }
        for (int year = start.getYear(); year <= end.getYear(); year++) {
            int asked = WorkingDays.inYear(start, end, year);
            if (asked == 0) continue;
            LeaveBalance balance = balance(type, year, countedRequests(employeeId, year), ignoring);
            if (asked > balance.remaining()) {
                int left = Math.max(balance.remaining(), 0);
                throw new FieldValidationException("type", "Not enough " + type.name().toLowerCase() + " leave left for " + year + ": "
                        + left + " working " + (left == 1 ? "day" : "days") + " left, and this request needs " + asked);
            }
        }
    }

    /** Approved and pending requests of the employee that touch the year. */
    private List<LeaveRequest> countedRequests(UUID employeeId, int year) {
        return leaveRequestRepository.findByEmployee_IdAndStatusInAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                employeeId, List.of(LeaveStatus.APPROVED, LeaveStatus.PENDING), LocalDate.of(year, 12, 31), LocalDate.of(year, 1, 1));
    }

    private LeaveBalance balance(LeaveType type, int year, List<LeaveRequest> counted, UUID ignoring) {
        int approved = 0;
        int pending = 0;
        for (LeaveRequest request : counted) {
            if (request.getType() != type || request.getId().equals(ignoring)) continue;
            int days = WorkingDays.inYear(request.getStartDate(), request.getEndDate(), year);
            if (request.getStatus() == LeaveStatus.APPROVED) approved += days;
            else pending += days;
        }
        Integer allowance = allowances.allowanceFor(type);
        return new LeaveBalance(type, year, allowance, approved, pending, allowance == null ? null : allowance - approved - pending);
    }
}
