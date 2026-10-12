package rw.ac.auca.controller;

import jakarta.validation.Valid;
import jakarta.validation.groups.Default;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.base.OnCreate;
import rw.ac.auca.base.PageRequests;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.domain.LeaveType;
import rw.ac.auca.leave_request.service.LeaveFilter;
import rw.ac.auca.leave_request.service.LeaveBalance;
import rw.ac.auca.leave_request.service.LeaveBalanceService;
import rw.ac.auca.leave_request.service.LeaveRequestService;
import rw.ac.auca.leave_request.service.RejectionRequest;
import rw.ac.auca.security.AuthenticatedUser;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/leave")
public class LeaveRequestController {

    private static final Set<String> SORT_FIELDS =
            Set.of("id", "startDate", "endDate", "status", "type", "createdAt");

    @Autowired
    private LeaveRequestService leaveRequestService;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest createLeaveRequest(@Validated({Default.class, OnCreate.class}) @RequestBody LeaveRequest leaveRequest){
        return leaveRequestService.registerLeaveRequest(leaveRequest);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest updateLeaveRequest(@PathVariable UUID id, @Valid @RequestBody LeaveRequest leaveRequest){
        leaveRequest.setId(id);
        return leaveRequestService.updateLeaveRequest(leaveRequest);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLeaveRequest(@PathVariable UUID id){
        LeaveRequest leaveRequest = new LeaveRequest();
        leaveRequest.setId(id);
        leaveRequestService.deleteLeaveRequest(leaveRequest);
    }

    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveRequest> findAllLeaveRequests(){
        return leaveRequestService.findAllLeaveRequests();
    }

    // One page at a time. ?page=0&size=10&sortBy=startDate&direction=desc
    // Optional filters, combined with AND: status, type, employeeId
    @GetMapping("/search-page")
    @ResponseStatus(HttpStatus.OK)
    public Page<LeaveRequest> findLeaveRequestsPage(@RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "10") int size,
                                                    @RequestParam(defaultValue = "startDate") String sortBy,
                                                    @RequestParam(defaultValue = "asc") String direction,
                                                    @RequestParam(required = false) LeaveStatus status,
                                                    @RequestParam(required = false) LeaveType type,
                                                    @RequestParam(required = false) UUID employeeId){
        return leaveRequestService.searchLeaveRequests(
                new LeaveFilter(status, type, employeeId),
                PageRequests.of(page, size, sortBy, direction, SORT_FIELDS));
    }

    /** One employee's balance for each kind of leave in a calendar year (default: this year), in working days. */
    @GetMapping("/employee/{employeeId}/balance")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveBalance> balance(@PathVariable UUID employeeId, @RequestParam(required = false) Integer year){
        return leaveBalanceService.balances(employeeId, LeaveBalanceService.yearOrCurrent(year));
    }

    @GetMapping("/employee/{employeeId}/page")
    @ResponseStatus(HttpStatus.OK)
    public Page<LeaveRequest> findByEmployeePage(@PathVariable UUID employeeId,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "10") int size,
                                                 @RequestParam(defaultValue = "startDate") String sortBy,
                                                 @RequestParam(defaultValue = "asc") String direction){
        return leaveRequestService.findLeaveRequestsByEmployee(employeeId,
                PageRequests.of(page, size, sortBy, direction, SORT_FIELDS));
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest findLeaveRequestById(@PathVariable UUID id){
        LeaveRequest leaveRequest = new LeaveRequest();
        leaveRequest.setId(id);
        return leaveRequestService.findLeaveRequestById(leaveRequest);
    }

    @GetMapping("/employee/{employeeId}")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveRequest> findByEmployee(@PathVariable UUID employeeId){
        return leaveRequestService.findLeaveRequestsByEmployee(employeeId);
    }

    @GetMapping("/status/{status}")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveRequest> findByStatus(@PathVariable LeaveStatus status){
        return leaveRequestService.findLeaveRequestsByStatus(status);
    }

    @GetMapping("/type/{type}")
    @ResponseStatus(HttpStatus.OK)
    public List<LeaveRequest> findByType(@PathVariable LeaveType type){
        return leaveRequestService.findLeaveRequestsByType(type);
    }

    @PatchMapping("/{id}/approve")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest approve(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser me){
        return leaveRequestService.approveLeaveRequest(id, me.employeeId());
    }

    @PatchMapping("/{id}/reject")
    @ResponseStatus(HttpStatus.OK)
    public LeaveRequest reject(@PathVariable UUID id, @Valid @RequestBody RejectionRequest body,
                               @AuthenticationPrincipal AuthenticatedUser me){
        return leaveRequestService.rejectLeaveRequest(id, me.employeeId(), body.reason());
    }
}
