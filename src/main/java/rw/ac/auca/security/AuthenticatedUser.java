package rw.ac.auca.security;

import rw.ac.auca.user.domain.Role;

import java.util.UUID;

/** Who is making the current request. Read in a controller with {@code @AuthenticationPrincipal}. */
public record AuthenticatedUser(UUID id, String username, Role role, UUID employeeId, boolean mustChangePassword,
                            boolean twoFactorSetupRequired) {
}
