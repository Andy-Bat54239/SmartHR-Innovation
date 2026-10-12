package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.service.EmployeeService;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.service.LeaveBalance;
import rw.ac.auca.leave_request.service.LeaveBalanceService;
import rw.ac.auca.leave_request.service.LeaveRequestService;
import rw.ac.auca.security.AuthenticatedUser;
import rw.ac.auca.training.domain.Training;
import rw.ac.auca.training.service.TrainingService;
import rw.ac.auca.user.dto.MeResponse;
import rw.ac.auca.user.dto.TwoFactorDtos;
import rw.ac.auca.user.dto.UserResponse;
import rw.ac.auca.user.service.UserService;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Self-service: what any signed-in person may see and do about themselves. Everything here is tied to the
 * employee record linked to the account, never to an id in the request, so nobody can reach someone else's data.
 */
@RestController
@RequestMapping("/me")
public class MeController {

    @Autowired
    private UserService userService;

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private LeaveRequestService leaveRequestService;

    @Autowired
    private TrainingService trainingService;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public MeResponse me(@AuthenticationPrincipal AuthenticatedUser me) {
        Employee employee = null;
        if (me.employeeId() != null) {
            employee = employeeService.findEmployeeById(withId(me.employeeId()));
        }
        return new MeResponse(UserResponse.from(userService.findById(me.id())), employee);
    }

    /** Turns emails about leave requests and trainings on or off for this account. Security alerts are always sent. */
    @PutMapping("/notifications")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse setNotifications(@AuthenticationPrincipal AuthenticatedUser me, @RequestBody TwoFactorDtos.NotificationSettings settings) {
        return UserResponse.from(userService.setEmailNotifications(me.id(), settings.emailNotifications()));
    }

    @GetMapping("/leave")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveRequest> myLeave(@AuthenticationPrincipal AuthenticatedUser me) {
        return leaveRequestService.findLeaveRequestsByEmployee(requireEmployee(me)).stream()
                .sorted(Comparator.comparing(LeaveRequest::getStartDate).reversed())
                .toList();
    }

    /** How much of each kind of leave is left this year (or the year asked for), in working days. */
    @GetMapping("/leave/balance")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveBalance> myLeaveBalance(@AuthenticationPrincipal AuthenticatedUser me,
                                             @RequestParam(required = false) Integer year) {
        return leaveBalanceService.balances(requireEmployee(me), LeaveBalanceService.yearOrCurrent(year));
    }

    /** Whatever employee the body names is ignored: the request is always submitted for the signed-in person. */
    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest submitLeave(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody LeaveRequest request) {
        request.setEmployee(withId(requireEmployee(me)));
        return leaveRequestService.registerLeaveRequest(request);
    }

    @PutMapping("/leave/{id}")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest updateMyLeave(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id,
                                      @Valid @RequestBody LeaveRequest request) {
        request.setId(id);
        return leaveRequestService.updateOwnLeaveRequest(request, requireEmployee(me));
    }

    /** Withdraws a request that has not been decided yet. */
    @DeleteMapping("/leave/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdrawMyLeave(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id) {
        leaveRequestService.withdrawOwnLeaveRequest(id, requireEmployee(me));
    }

    @GetMapping("/trainings")
    @ResponseStatus(HttpStatus.OK)
    public List<Training> myTrainings(@AuthenticationPrincipal AuthenticatedUser me) {
        return trainingService.findTrainingsByEmployee(requireEmployee(me));
    }

    private UUID requireEmployee(AuthenticatedUser me) {
        if (me.employeeId() == null) {
            throw new IllegalStateException("Your account is not linked to an employee record, so there is nothing to show here");
        }
        return me.employeeId();
    }

    private Employee withId(UUID id) {
        Employee employee = new Employee();
        employee.setId(id);
        return employee;
    }
}
