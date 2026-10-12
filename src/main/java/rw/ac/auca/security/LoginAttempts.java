package rw.ac.auca.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import rw.ac.auca.exception.TooManyAttemptsException;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Counts wrong passwords per account and locks it for a while after too many in a row.
 * It is kept in memory, so a restart clears it, which is acceptable for a single-server app.
 * Unknown usernames are counted too, so a locked-out answer does not reveal whether an account exists.
 */
@Component
public class LoginAttempts {

    private record State(int failures, Instant lockedUntil, Instant lastFailure) {
    }

    // bounds the memory an attacker can use by trying endless made-up usernames
    private static final int PRUNE_ABOVE = 5_000;

    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();
    private final SecurityProperties properties;

    @Autowired
    public LoginAttempts(SecurityProperties properties) {
        this.properties = properties;
    }

    /** Throws TooManyAttemptsException while the key is locked. */
    public void checkNotLocked(String key) {
        State state = states.get(key);
        Instant now = Instant.now();
        if (state != null && state.lockedUntil() != null && now.isBefore(state.lockedUntil())) {
            throw new TooManyAttemptsException(Duration.between(now, state.lockedUntil()).toSeconds() + 1);
        }
    }

    /** Counts a wrong password. Returns true when this one just locked the key. */
    public boolean recordFailure(String key) {
        Instant now = Instant.now();
        State updated = states.compute(key, (k, old) -> {
            // a lock that has run out starts a fresh count
            boolean expired = old != null && old.lockedUntil() != null && !now.isBefore(old.lockedUntil());
            int failures = old == null || expired ? 1 : old.failures() + 1;
            Instant lockedUntil = failures >= properties.maxFailedLogins() ? now.plus(properties.lockoutDuration()) : null;
            return new State(failures, lockedUntil, now);
        });
        if (states.size() > PRUNE_ABOVE) {
            Instant staleBefore = now.minus(properties.lockoutDuration().multipliedBy(2));
            states.values().removeIf(s -> s.lastFailure().isBefore(staleBefore));
        }
        return updated.lockedUntil() != null && updated.failures() == properties.maxFailedLogins();
    }

    public void recordSuccess(String key) {
        states.remove(key);
    }
}
