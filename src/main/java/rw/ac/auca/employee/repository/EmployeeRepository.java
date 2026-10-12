package rw.ac.auca.employee.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.employee.domain.Gender;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

// JpaSpecificationExecutor lets the search endpoint combine any subset of its optional filters
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID>, JpaSpecificationExecutor<Employee> {
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    List<Employee> findByLocation_IdIn(Collection<UUID> locationIds);
    Page<Employee> findByDepartment_Id(UUID departmentId, Pageable pageable);
    List<Employee> findByStatus(EmployeeStatus status);
    List<Employee> findByGender(Gender gender);

    // --- figures for the dashboard ---
    long countByStatus(EmployeeStatus status);
    long countByDepartmentIsNull();
    long countByLocationIsNull();
    long countByHireDateLessThanEqual(LocalDate date);

    /** The newest hires first (those hired the same day: the one entered last first). */
    List<Employee> findByOrderByHireDateDescCreatedAtDesc(Pageable pageable);

    @Query("select e.department.id as id, count(e) as total from Employee e where e.department is not null group by e.department.id")
    List<IdCount> countByDepartment();

    @Query("select e.location.id as id, count(e) as total from Employee e where e.location is not null group by e.location.id")
    List<IdCount> countByLocation();

    /** One row of a "how many per X" query. */
    interface IdCount {
        UUID getId();
        long getTotal();
    }
}
