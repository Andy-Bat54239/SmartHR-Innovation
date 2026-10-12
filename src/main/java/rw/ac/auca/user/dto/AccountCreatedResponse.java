package rw.ac.auca.user.dto;

/** Returned when an account is created or its password is reset. The temporary password is shown this once. */
public record AccountCreatedResponse(UserResponse user, String temporaryPassword) {
}
