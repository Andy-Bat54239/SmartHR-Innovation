package rw.ac.auca.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/** Settings under "smarthr.security" in application.properties. */
@ConfigurationProperties(prefix = "smarthr.security")
public record SecurityProperties(
        String jwtSecret,
        Duration tokenTtl,
        int maxFailedLogins,
        Duration lockoutDuration,
        BootstrapAdmin bootstrapAdmin) {

    public SecurityProperties {
        if (tokenTtl == null) tokenTtl = Duration.ofHours(8);
        if (maxFailedLogins <= 0) maxFailedLogins = 5;
        if (lockoutDuration == null) lockoutDuration = Duration.ofMinutes(10);
        if (bootstrapAdmin == null) bootstrapAdmin = new BootstrapAdmin("admin@smarthr.local", "");
    }

    /** The first administrator. An empty password means "generate one and print it once". */
    public record BootstrapAdmin(String username, String password) {
    }
}
