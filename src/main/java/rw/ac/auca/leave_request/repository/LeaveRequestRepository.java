package rw.ac.auca.leave_request.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.domain.LeaveType;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
// JpaSpecificationExecutor lets the search endpoint combine any subset of its optional filters
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, UUID>, JpaSpecificationExecutor<LeaveRequest> {
    List<LeaveRequest> findByEmployee_Id(UUID employeeId);
    Page<LeaveRequest> findByEmployee_Id(UUID employeeId, Pageable pageable);
    List<LeaveRequest> findByStatus(LeaveStatus status);
    /** Requests of the employee with one of the statuses that overlap the period: start on or before {@code end}, end on or after {@code start}. */
    List<LeaveRequest> findByEmployee_IdAndStatusInAndStartDateLessThanEqualAndEndDateGreaterThanEqual(UUID employeeId, Collection<LeaveStatus> statuses, LocalDate end, LocalDate start);
    List<LeaveRequest> findByType(LeaveType type);

    // --- figures for the dashboard ---
    long countByStatus(LeaveStatus status);
    long countByStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(LeaveStatus status, LocalDate start, LocalDate end);

    /** Approved leave that has not ended yet, the soonest first. */
    List<LeaveRequest> findByStatusAndEndDateGreaterThanEqualOrderByStartDateAscEndDateAsc(LeaveStatus status, LocalDate from, Pageable pageable);

    /** People (not requests: someone may have two overlapping ones) with leave of that status covering the day. */
    @Query("select count(distinct l.employee.id) from LeaveRequest l where l.status = :status and l.startDate <= :day and l.endDate >= :day")
    long countPeopleOnLeave(@Param("status") LeaveStatus status, @Param("day") LocalDate day);

    /** The same, only for employees whose status is {@code employeeStatus}. */
    @Query("select count(distinct l.employee.id) from LeaveRequest l where l.status = :status and l.employee.status = :employeeStatus and l.startDate <= :day and l.endDate >= :day")
    long countPeopleOnLeaveByEmployeeStatus(@Param("status") LeaveStatus status, @Param("employeeStatus") EmployeeStatus employeeStatus, @Param("day") LocalDate day);
}
