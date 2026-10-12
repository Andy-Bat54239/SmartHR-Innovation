package rw.ac.auca.employee.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.department.domain.Department;
import rw.ac.auca.department.repository.DepartmentRepository;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.employee.domain.Gender;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;
import rw.ac.auca.employee_profile.repository.EmployeeProfileRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;
import rw.ac.auca.exception.DuplicateResourceException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;
import rw.ac.auca.location.repository.LocationRepository;
import rw.ac.auca.location.service.LocationService;
import rw.ac.auca.user.service.UserService;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class EmployeeServiceImpl implements EmployeeService{

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private AuditService audit;

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private LocationService locationService;

    @Autowired
    private UserService userService;

    @Override
    @Transactional
    public Employee registerEmployee(Employee employee) {
        if (employeeRepository.existsByEmail(employee.getEmail())) {
            throw new DuplicateResourceException("email", "Email already in use: " + employee.getEmail());
        }
        if (employeeRepository.existsByPhone(employee.getPhone())) {
            throw new DuplicateResourceException("phone", "Phone already in use: " + employee.getPhone());
        }
        employee.setDepartment(resolveDepartment(employee.getDepartment()));
        employee.setLocation(resolveLocation(employee.getLocation()));
        employee.setProfile(resolveProfile(employee.getProfile(), null));
        Employee saved = employeeRepository.save(employee);
        audit.created(AuditEntity.EMPLOYEE, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public Employee updateEmployee(Employee employee) {
        Employee employeeFound = findEmployeeById(employee);
        AuditSnapshot before = AuditSnapshots.of(employeeFound);

        // Only re-check uniqueness when the value actually changes
        if (!employeeFound.getEmail().equals(employee.getEmail())
                && employeeRepository.existsByEmail(employee.getEmail())) {
            throw new DuplicateResourceException("email", "Email already in use: " + employee.getEmail());
        }
        if (!employeeFound.getPhone().equals(employee.getPhone())
                && employeeRepository.existsByPhone(employee.getPhone())) {
            throw new DuplicateResourceException("phone", "Phone already in use: " + employee.getPhone());
        }

        employeeFound.setFirstName(employee.getFirstName());
        employeeFound.setLastName(employee.getLastName());
        employeeFound.setEmail(employee.getEmail());
        employeeFound.setPhone(employee.getPhone());
        employeeFound.setGender(employee.getGender());
        employeeFound.setStatus(employee.getStatus());
        employeeFound.setHireDate(employee.getHireDate());
        employeeFound.setDepartment(resolveDepartment(employee.getDepartment()));
        employeeFound.setLocation(resolveLocation(employee.getLocation()));
        // A missing profile in the body means "leave the profile as it is"
        // (clearing it would delete the profile row through orphanRemoval)
        if (employee.getProfile() != null) {
            employeeFound.setProfile(resolveProfile(employee.getProfile(), employeeFound));
        }
        Employee saved = employeeRepository.save(employeeFound);
        audit.updated(AuditEntity.EMPLOYEE, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public void deleteEmployee(Employee employee) {
        Employee found = findEmployeeById(employee);
        AuditSnapshot snapshot = AuditSnapshots.of(found);
        String label = AuditSnapshots.label(found);
        int leaveRequests = found.getLeaveRequests().size();
        int trainings = found.getTrainings().size();
        boolean hadProfile = found.getProfile() != null;

        userService.removeAccountOf(found.getId());   // their login goes with them
        employeeRepository.delete(found);

        List<String> gone = new ArrayList<>();
        if (hadProfile) gone.add("their profile");
        if (leaveRequests > 0) gone.add(leaveRequests + (leaveRequests == 1 ? " leave request" : " leave requests"));
        if (trainings > 0) gone.add(trainings + (trainings == 1 ? " training enrolment" : " training enrolments"));
        audit.deleted(AuditEntity.EMPLOYEE, found.getId(), label, snapshot, gone.isEmpty() ? null : "Also removed: " + String.join(", ", gone));
    }

    @Override
    @Transactional(readOnly = true)
    public Employee findEmployeeById(Employee employee) {
        return employeeRepository.findById(employee.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employee.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findAllEmployees() {
        return employeeRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Employee> searchEmployees(EmployeeFilter filter, Pageable pageable) {
        Specification<Employee> spec = (root, query, cb) -> cb.conjunction();

        String text = filter.q() == null ? "" : filter.q().trim().toLowerCase();
        if (!text.isEmpty()) {
            String pattern = "%" + escapeLike(text) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.<String>get("firstName")), pattern, '\\'),
                    cb.like(cb.lower(root.<String>get("lastName")), pattern, '\\'),
                    cb.like(cb.lower(cb.concat(cb.concat(root.<String>get("firstName"), " "), root.<String>get("lastName"))), pattern, '\\'),
                    cb.like(cb.lower(root.<String>get("email")), pattern, '\\'),
                    cb.like(root.<String>get("phone"), pattern, '\\')));
        }
        if (filter.status() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), filter.status()));
        }
        if (filter.gender() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("gender"), filter.gender()));
        }
        if (filter.departmentId() != null) {
            if (!departmentRepository.existsById(filter.departmentId())) {
                throw new ResourceNotFoundException("Department", filter.departmentId());
            }
            spec = spec.and((root, query, cb) -> cb.equal(root.get("department").get("id"), filter.departmentId()));
        }
        if (filter.provinceId() != null) {
            List<UUID> locationIds = provinceLocationIds(filter.provinceId());
            spec = spec.and((root, query, cb) -> root.get("location").get("id").in(locationIds));
        }
        return employeeRepository.findAll(spec, pageable);
    }

    /** Escapes the LIKE wildcards so a search for "50%" or "a_b" matches those characters literally. */
    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Employee> findEmployeesByDepartment(UUID departmentId, Pageable pageable) {
        if (!departmentRepository.existsById(departmentId)) {
            throw new ResourceNotFoundException("Department", departmentId);
        }
        return employeeRepository.findByDepartment_Id(departmentId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findEmployeesByStatus(EmployeeStatus status) {
        return employeeRepository.findByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findEmployeesByGender(Gender gender) {
        return employeeRepository.findByGender(gender);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findEmployeesByProvinceId(UUID provinceId) {
        return employeeRepository.findByLocation_IdIn(provinceLocationIds(provinceId));
    }

    /**
     * The province plus every location below it. An employee points at a village (or any level),
     * while the province is several levels above, so the ids of the whole subtree are needed.
     */
    private List<UUID> provinceLocationIds(UUID provinceId) {
        Location province = locationRepository.findById(provinceId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", provinceId));
        if (province.getType() != LocationType.PROVINCE) {
            throw new IllegalArgumentException("Location " + provinceId + " is a " + province.getType() + ", not a PROVINCE");
        }
        return locationService.findAllDescendantIds(provinceId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findEmployeesByProvinceCode(String code) {
        return findEmployeesByProvinceId(locationService.findProvinceByCode(code).getId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findEmployeesByProvinceName(String name) {
        return findEmployeesByProvinceId(locationService.findProvinceByName(name).getId());
    }

    @Override
    @Transactional(readOnly = true)
    public Location findProvinceOfEmployee(UUID employeeId) {
        return findLocationPath(employeeId).get(0);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Location> findLocationPath(UUID employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));
        if (employee.getLocation() == null) {
            throw new ResourceNotFoundException("Employee " + employeeId + " has no location assigned");
        }
        List<Location> path = new ArrayList<>();
        for (Location current = employee.getLocation(); current != null; current = current.getParent()) {
            path.add(current);
        }
        Collections.reverse(path);   // province first
        return path;
    }

    /** The request body only carries {"id": ...}; load the real department (404 if unknown). */
    private Department resolveDepartment(Department reference) {
        if (reference == null || reference.getId() == null) {
            return null;
        }
        return departmentRepository.findById(reference.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", reference.getId()));
    }

    /** Same idea for the location: only {"id": ...} is expected in the body. */
    private Location resolveLocation(Location reference) {
        if (reference == null || reference.getId() == null) {
            return null;
        }
        return locationRepository.findById(reference.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", reference.getId()));
    }

    /** Load the real profile and make sure it is not already linked to another employee. */
    private EmployeeProfile resolveProfile(EmployeeProfile reference, Employee owner) {
        if (reference == null || reference.getId() == null) {
            return null;
        }
        EmployeeProfile profile = employeeProfileRepository.findById(reference.getId())
                .orElseThrow(() -> new ResourceNotFoundException("EmployeeProfile", reference.getId()));
        Employee current = profile.getEmployee();
        if (current != null && (owner == null || !current.getId().equals(owner.getId()))) {
            throw new DuplicateResourceException("Profile is already linked to another employee");
        }
        return profile;
    }
}
