package rw.ac.auca.dashboard.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.dashboard.service.DashboardSummary.EmployeeStats;
import rw.ac.auca.dashboard.service.DashboardSummary.GroupCount;
import rw.ac.auca.dashboard.service.DashboardSummary.LeaveStats;
import rw.ac.auca.dashboard.service.DashboardSummary.MonthTotal;
import rw.ac.auca.dashboard.service.DashboardSummary.Person;
import rw.ac.auca.dashboard.service.DashboardSummary.RecentEmployee;
import rw.ac.auca.dashboard.service.DashboardSummary.TrainingStats;
import rw.ac.auca.dashboard.service.DashboardSummary.UpcomingLeave;
import rw.ac.auca.department.repository.DepartmentRepository;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.employee.repository.EmployeeRepository.IdCount;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.leave_request.domain.LeaveStatus;
import rw.ac.auca.leave_request.repository.LeaveRequestRepository;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;
import rw.ac.auca.location.repository.LocationRepository;
import rw.ac.auca.location.repository.LocationRepository.LocationNode;
import rw.ac.auca.training.domain.Training;
import rw.ac.auca.training.repository.TrainingRepository;

import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DashboardServiceImpl implements DashboardService {

    // the tree is at most five levels deep; this only guards against a corrupt loop
    private static final int MAX_DEPTH = 10;

    /** The growth chart shows this many months, the current one included. */
    private static final int MONTHS_SHOWN = 6;
    private static final int LIST_SIZE = 5;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private TrainingRepository trainingRepository;

    @Override
    @Transactional(readOnly = true)
    public DashboardSummary getSummary() {
        LocalDate today = LocalDate.now();

        long active = employeeRepository.countByStatus(EmployeeStatus.ACTIVE);
        long inactive = employeeRepository.countByStatus(EmployeeStatus.INACTIVE);
        long activeOnLeave = leaveRequestRepository.countPeopleOnLeaveByEmployeeStatus(LeaveStatus.APPROVED, EmployeeStatus.ACTIVE, today);

        return new DashboardSummary(
                new EmployeeStats(active + inactive, active, inactive, active - activeOnLeave),
                headcountByDepartment(),
                headcountByProvince(),
                new LeaveStats(
                        leaveRequestRepository.countByStatus(LeaveStatus.PENDING),
                        leaveRequestRepository.countPeopleOnLeave(LeaveStatus.APPROVED, today),
                        leaveRequestRepository.countPeopleOnLeave(LeaveStatus.APPROVED, today.minusWeeks(1))),
                trainingStats(today),
                headcountByMonth(today),
                upcomingLeave(today),
                recentEmployees());
    }

    /**
     * How many people had been hired by the end of each of the last months. The system does not record when someone left,
     * so an employee who is now inactive still counts here.
     */
    private List<MonthTotal> headcountByMonth(LocalDate today) {
        YearMonth current = YearMonth.from(today);
        List<MonthTotal> months = new ArrayList<>();
        for (int back = MONTHS_SHOWN - 1; back >= 0; back--) {
            YearMonth month = current.minusMonths(back);
            LocalDate asOf = back == 0 ? today : month.atEndOfMonth();
            months.add(new MonthTotal(month.toString(), employeeRepository.countByHireDateLessThanEqual(asOf)));
        }
        return months;
    }

    /** Approved leave that is going on now or starts later, the soonest first. */
    private List<UpcomingLeave> upcomingLeave(LocalDate today) {
        List<LeaveRequest> requests = leaveRequestRepository.findByStatusAndEndDateGreaterThanEqualOrderByStartDateAscEndDateAsc(
                LeaveStatus.APPROVED, today, PageRequest.of(0, LIST_SIZE));
        return requests.stream()
                .map(r -> new UpcomingLeave(r.getId(), personOf(r.getEmployee()), r.getType(), r.getStartDate(), r.getEndDate()))
                .toList();
    }

    private List<RecentEmployee> recentEmployees() {
        return employeeRepository.findByOrderByHireDateDescCreatedAtDesc(PageRequest.of(0, LIST_SIZE)).stream()
                .map(e -> new RecentEmployee(
                        personOf(e),
                        e.getEmail(),
                        e.getDepartment() == null ? null : e.getDepartment().getName(),
                        provinceNameOf(e.getLocation()),
                        e.getHireDate(),
                        e.getStatus()))
                .toList();
    }

    private Person personOf(Employee employee) {
        EmployeeProfile profile = employee.getProfile();
        return new Person(employee.getId(), employee.getFirstName(), employee.getLastName(), profile == null ? null : profile.getProfilePhotoUrl());
    }

    /** Walks up the location chain to its top (the province); null when the employee has no location. */
    private String provinceNameOf(Location location) {
        Location top = location;
        for (int depth = 0; top != null && top.getParent() != null && depth < MAX_DEPTH; depth++) {
            top = top.getParent();
        }
        return top == null ? null : top.getName();
    }

    /** Every department, even an empty one, biggest first; employees with no department come last. */
    private List<GroupCount> headcountByDepartment() {
        Map<UUID, Long> counts = toMap(employeeRepository.countByDepartment());
        List<GroupCount> groups = new ArrayList<>(departmentRepository.findAll().stream()
                .map(d -> new GroupCount(d.getId(), d.getName(), counts.getOrDefault(d.getId(), 0L)))
                .sorted(bySizeThenName())
                .toList());
        addUnassigned(groups, "No department", employeeRepository.countByDepartmentIsNull());
        return groups;
    }

    /**
     * Employees point at a village (or any level), so each location's count is rolled up to its province.
     * Every province is listed, even an empty one; employees with no location come last.
     */
    private List<GroupCount> headcountByProvince() {
        Map<UUID, LocationNode> nodes = new HashMap<>();
        for (LocationNode node : locationRepository.findAllNodes()) {
            nodes.put(node.getId(), node);
        }

        Map<UUID, Long> perProvince = new HashMap<>();
        long unresolved = 0;
        for (IdCount placed : employeeRepository.countByLocation()) {
            UUID province = provinceOf(placed.getId(), nodes);
            if (province == null) {
                unresolved += placed.getTotal();
            } else {
                perProvince.merge(province, placed.getTotal(), Long::sum);
            }
        }

        List<GroupCount> groups = new ArrayList<>(nodes.values().stream()
                .filter(n -> n.getType() == LocationType.PROVINCE)
                .map(n -> new GroupCount(n.getId(), n.getName(), perProvince.getOrDefault(n.getId(), 0L)))
                .sorted(bySizeThenName())
                .toList());
        addUnassigned(groups, "No location", employeeRepository.countByLocationIsNull() + unresolved);
        return groups;
    }

    private UUID provinceOf(UUID locationId, Map<UUID, LocationNode> nodes) {
        LocationNode node = nodes.get(locationId);
        for (int depth = 0; node != null && depth < MAX_DEPTH; depth++) {
            if (node.getType() == LocationType.PROVINCE) {
                return node.getId();
            }
            node = nodes.get(node.getParentId());
        }
        return null;
    }

    /** Same rules as the trainings page: no dates = unscheduled, starts later = upcoming, ended = completed. */
    private TrainingStats trainingStats(LocalDate today) {
        long ongoing = 0, upcoming = 0, completed = 0, unscheduled = 0;
        for (Training training : trainingRepository.findAll()) {
            if (training.getStartDate() == null && training.getEndDate() == null) {
                unscheduled++;
            } else if (training.getStartDate() != null && training.getStartDate().isAfter(today)) {
                upcoming++;
            } else if (training.getEndDate() != null && training.getEndDate().isBefore(today)) {
                completed++;
            } else {
                ongoing++;
            }
        }
        return new TrainingStats(ongoing, upcoming, completed, unscheduled);
    }

    private Map<UUID, Long> toMap(List<IdCount> counts) {
        Map<UUID, Long> map = new HashMap<>();
        counts.forEach(c -> map.put(c.getId(), c.getTotal()));
        return map;
    }

    private Comparator<GroupCount> bySizeThenName() {
        return Comparator.comparingLong(GroupCount::count).reversed().thenComparing(GroupCount::name, String.CASE_INSENSITIVE_ORDER);
    }

    private void addUnassigned(List<GroupCount> groups, String label, long count) {
        if (count > 0) {
            groups.add(new GroupCount(null, label, count));
        }
    }
}
