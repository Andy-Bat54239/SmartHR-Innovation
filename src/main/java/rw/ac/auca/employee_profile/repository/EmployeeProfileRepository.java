package rw.ac.auca.employee_profile.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;

import java.util.UUID;

@Repository
public interface EmployeeProfileRepository extends JpaRepository<EmployeeProfile, UUID> {
    boolean existsByNationalId(String nationalId);
}
