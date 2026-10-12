package rw.ac.auca.user.dto;

import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.domain.Role;

import java.time.LocalDateTime;
import java.util.UUID;

/** An account as the API shows it: never the password, never the token version. */
public record UserResponse(
        UUID id,
        String username,
        Role role,
        boolean enabled,
        boolean mustChangePassword,
        /** signing in also needs a code from an authenticator app */
        boolean twoFactorEnabled,
        /** the role must use two-factor sign-in and has not set it up yet: nothing else works until it does */
        boolean twoFactorSetupRequired,
        /** emails about leave requests and trainings are on */
        boolean emailNotifications,
        EmployeeRef employee,
        LocalDateTime createdAt) {

    /** Just enough of the linked employee to show a name. */
    public record EmployeeRef(UUID id, String firstName, String lastName) {
    }

    public static UserResponse from(AppUser user) {
        Employee e = user.getEmployee();
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isEnabled(),
                user.isMustChangePassword(),
                user.isTwoFactorEnabled(),
                user.getRole().requiresTwoFactor() && !user.isTwoFactorEnabled(),
                user.isEmailNotifications(),
                e == null ? null : new EmployeeRef(e.getId(), e.getFirstName(), e.getLastName()),
                user.getCreatedAt());
    }
}
