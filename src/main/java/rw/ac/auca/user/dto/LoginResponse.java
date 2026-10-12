package rw.ac.auca.user.dto;

import java.time.Instant;

/**
 * Either a finished login ({@code token}, {@code expiresAt} and {@code user} are set, to send as
 * "Authorization: Bearer <token>"), or, for an account with two-factor sign-in, a challenge
 * ({@code twoFactorRequired} is true and only {@code challengeToken} is set: send it back with the code to
 * {@code POST /auth/login/2fa}).
 */
public record LoginResponse(String token, Instant expiresAt, UserResponse user, boolean twoFactorRequired, String challengeToken) {

    public static LoginResponse signedIn(String token, Instant expiresAt, UserResponse user) {
        return new LoginResponse(token, expiresAt, user, false, null);
    }

    public static LoginResponse challenge(String challengeToken) {
        return new LoginResponse(null, null, null, true, challengeToken);
    }
}
