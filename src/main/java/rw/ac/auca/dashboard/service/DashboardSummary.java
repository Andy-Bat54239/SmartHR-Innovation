package rw.ac.auca.dashboard.service;

import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.leave_request.domain.LeaveType;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The numbers behind the dashboard page, computed on the server so the browser does not load every record. */
public record DashboardSummary(
        EmployeeStats employees,
        List<GroupCount> byDepartment,
        List<GroupCount> byProvince,
        LeaveStats leave,
        TrainingStats trainings,
        List<MonthTotal> headcountByMonth,
        List<UpcomingLeave> upcomingLeave,
        List<RecentEmployee> recentEmployees) {

    /** {@code availableToday}: active employees who are not on approved leave today. */
    public record EmployeeStats(long total, long active, long inactive, long availableToday) {
    }

    /** One bar of a headcount chart. {@code id} is null for the "nobody assigned" bar. */
    public record GroupCount(UUID id, String name, long count) {
    }

    /**
     * {@code pending} waits for a decision; {@code onLeaveToday} is the number of people with approved leave covering today,
     * {@code onLeaveLastWeek} the same count for this day a week ago.
     */
    public record LeaveStats(long pending, long onLeaveToday, long onLeaveLastWeek) {
    }

    public record TrainingStats(long ongoing, long upcoming, long completed, long unscheduled) {
    }

    /** Everyone hired on or before the end of {@code month} ("2026-05"); the current month counts up to today. */
    public record MonthTotal(String month, long total) {
    }

    /** Just enough of an employee to show a name and a picture. */
    public record Person(UUID id, String firstName, String lastName, String photoUrl) {
    }

    /** Approved leave that is under way or still to come. */
    public record UpcomingLeave(UUID id, Person employee, LeaveType type, LocalDate startDate, LocalDate endDate) {
    }

    /** {@code province} is the top of the employee's location chain, null without a location. */
    public record RecentEmployee(Person person, String email, String department, String province, LocalDate hireDate, EmployeeStatus status) {
    }
}
