package rw.ac.auca.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import rw.ac.auca.user.domain.Role;

import java.util.UUID;

/** The password is not chosen here: the server generates a temporary one and shows it once. */
public record CreateUserRequest(
        @NotBlank(message = "Username is required")
        @Email(message = "Username must be an email address")
        @Size(max = 150, message = "Username must be at most 150 characters") String username,
        @NotNull(message = "Role is required") Role role,
        /** required for the EMPLOYEE role, optional for the others */
        UUID employeeId) {
}
