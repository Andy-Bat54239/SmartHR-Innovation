package rw.ac.auca.audit.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import rw.ac.auca.security.AuthenticatedUser;

import java.util.UUID;

/** Who is doing the current thing: the signed-in account, or "system" when nobody is (start-up work). */
public record AuditActor(UUID id, String username, String role) {

    public static final AuditActor SYSTEM = new AuditActor(null, "system", null);

    public static AuditActor current() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return new AuditActor(user.id(), user.username(), user.role().name());
        }
        return SYSTEM;
    }
}
