package rw.ac.auca.google;

import org.springframework.stereotype.Component;
import rw.ac.auca.user.dto.LoginResponse;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;

/**
 * After Google has vouched for the person, the browser is sent back to the web app with a one-time code, not with the
 * login token itself (a token in an address ends up in history and logs). The app swaps the code for the login with one
 * POST. A code works once and for 60 seconds, and lives only in this server's memory.
 */
@Component
public class GoogleLoginCodes {

    private record Pending(LoginResponse response, Instant expiresAt) {
    }

    private static final int MAX_PENDING = 1_000;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Pending> pending = new ConcurrentHashMap<>();

    public String store(LoginResponse response) {
        Instant now = Instant.now();
        pending.values().removeIf(p -> p.expiresAt().isBefore(now));
        if (pending.size() >= MAX_PENDING) {
            throw new GoogleSignInException("Too many sign-ins are in progress. Try again in a minute.");
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        pending.put(code, new Pending(response, now.plusSeconds(60)));
        return code;
    }

    /** Hands out the login for a code, once. */
    public LoginResponse redeem(String code) {
        Pending found = code == null ? null : pending.remove(code);
        if (found == null || found.expiresAt().isBefore(Instant.now())) {
            throw new GoogleSignInException("That Google sign-in has expired. Start again.");
        }
        return found.response();
    }
}
