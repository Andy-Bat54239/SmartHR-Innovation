package rw.ac.auca.user.dto;

import jakarta.validation.constraints.NotNull;
import rw.ac.auca.user.domain.Role;

import java.util.UUID;

/** Replaces the role, the on/off switch and the employee link. The username and password are changed elsewhere. */
public record UpdateUserRequest(
        @NotNull(message = "Role is required") Role role,
        @NotNull(message = "Status is required") Boolean enabled,
        UUID employeeId) {
}
