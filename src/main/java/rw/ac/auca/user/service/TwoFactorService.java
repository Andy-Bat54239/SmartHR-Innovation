package rw.ac.auca.user.service;

import rw.ac.auca.user.domain.AppUser;

import java.util.List;
import java.util.UUID;

/** Two-factor sign-in with an authenticator app (TOTP) and one-time recovery codes. */
public interface TwoFactorService {

    /** What the person scans (the {@code otpauthUri} as a QR code) or types in (the {@code secret}). */
    record Setup(String secret, String otpauthUri) {
    }

    /** Starts (or restarts) setting up: makes a new secret. 409 when two-factor is already on. It is not on until {@link #enable}. */
    Setup beginSetup(UUID userId);

    /** Turns it on once the person proves the app works by typing a current code. Returns the recovery codes, shown only this once. */
    List<String> enable(UUID userId, String code);

    /** Turns it off (password and a current code needed). 409 for roles that must use it. */
    void disable(UUID userId, String password, String code);

    /** Replaces the recovery codes (password and a current code needed). Returns the new ones, shown only this once. */
    List<String> regenerateRecoveryCodes(UUID userId, String password, String code);

    /** How many recovery codes are still unused. */
    int recoveryCodesLeft(AppUser user);

    /**
     * The second step of signing in: accepts a current authenticator code or one unused recovery code (which is then used up).
     * Too many wrong codes lock the account for a while, like wrong passwords.
     */
    void verifyLogin(AppUser user, String code);

    /** An administrator removes someone's second factor (lost phone). Ends their logins; an administrator must set it up again. */
    AppUser reset(UUID targetId, UUID actingUserId);
}
