package rw.ac.auca.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.domain.Role;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByEmployee_Id(UUID employeeId);
    Optional<AppUser> findByEmployee_Id(UUID employeeId);
    long countByRoleAndEnabledTrue(Role role);
    java.util.List<AppUser> findByRoleInAndEnabledTrue(java.util.Collection<Role> roles);
}
