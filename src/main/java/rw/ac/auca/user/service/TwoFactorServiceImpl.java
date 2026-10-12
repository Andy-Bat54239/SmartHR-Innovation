package rw.ac.auca.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshots;
import rw.ac.auca.exception.FieldValidationException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.notification.NotificationEvents;
import rw.ac.auca.security.LoginAttempts;
import rw.ac.auca.security.Totp;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.repository.AppUserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.BadCredentialsException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class TwoFactorServiceImpl implements TwoFactorService {

    private static final String ISSUER = "SmartHR";
    private static final int RECOVERY_CODES = 10;
    // no 0/O/1/I: easy to read off a piece of paper
    private static final String RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private AppUserRepository users;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private LoginAttempts attempts;

    @Autowired
    private AuditService audit;

    @Autowired
    private ApplicationEventPublisher events;

    @Override
    @Transactional
    public Setup beginSetup(UUID userId) {
        AppUser user = find(userId);
        if (user.isTwoFactorEnabled()) {
            throw new IllegalStateException("Two-factor sign-in is already on. Turn it off first to set it up again");
        }
        user.setTotpSecret(Totp.newSecret());
        users.save(user);
        return new Setup(user.getTotpSecret(), Totp.otpauthUri(ISSUER, user.getUsername(), user.getTotpSecret()));
    }

    @Override
    @Transactional
    public List<String> enable(UUID userId, String code) {
        AppUser user = find(userId);
        if (user.isTwoFactorEnabled()) {
            throw new IllegalStateException("Two-factor sign-in is already on");
        }
        if (user.getTotpSecret() == null) {
            throw new IllegalStateException("Start the setup first");
        }
        acceptCode(user, code, "code");
        user.setTwoFactorEnabled(true);
        List<String> recovery = newRecoveryCodes(user);
        users.save(user);
        audit.action(AuditAction.ACCOUNT_UPDATED, AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user),
                "Turned on two-factor sign-in for " + user.getUsername(), null);
        events.publishEvent(new NotificationEvents.SecurityAlert(user.getUsername(), "Two-factor sign-in was turned on",
                "Two-factor sign-in with an authenticator app was turned on for your SmartHR account."));
        return recovery;
    }

    @Override
    @Transactional
    public void disable(UUID userId, String password, String code) {
        AppUser user = find(userId);
        if (user.getRole().requiresTwoFactor()) {
            throw new IllegalStateException("Accounts with the " + user.getRole() + " role must use two-factor sign-in");
        }
        if (!user.isTwoFactorEnabled()) {
            throw new IllegalStateException("Two-factor sign-in is not on");
        }
        confirmPasswordAndCode(user, password, code);
        clear(user);
        users.save(user);
        audit.action(AuditAction.ACCOUNT_UPDATED, AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user),
                "Turned off two-factor sign-in for " + user.getUsername(), null);
        events.publishEvent(new NotificationEvents.SecurityAlert(user.getUsername(), "Two-factor sign-in was turned off",
                "Two-factor sign-in was turned off for your SmartHR account. If this was not you, change your password and tell an administrator."));
    }

    @Override
    @Transactional
    public List<String> regenerateRecoveryCodes(UUID userId, String password, String code) {
        AppUser user = find(userId);
        if (!user.isTwoFactorEnabled()) {
            throw new IllegalStateException("Two-factor sign-in is not on");
        }
        confirmPasswordAndCode(user, password, code);
        List<String> recovery = newRecoveryCodes(user);
        users.save(user);
        audit.action(AuditAction.ACCOUNT_UPDATED, AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user),
                "Made new recovery codes for " + user.getUsername(), null);
        return recovery;
    }

    @Override
    public int recoveryCodesLeft(AppUser user) {
        return split(user.getRecoveryCodeHashes()).size();
    }

    @Override
    @Transactional
    public void verifyLogin(AppUser user, String code) {
        String key = "2fa:" + user.getId();
        attempts.checkNotLocked(key);
        try {
            String typed = code == null ? "" : code.replaceAll("[\\s-]", "");
            if (typed.matches("\\d{6}")) {
                acceptCode(user, typed, "code");
            } else {
                useRecoveryCode(user, typed);
            }
        } catch (FieldValidationException e) {
            boolean lockedNow = attempts.recordFailure(key);
            audit.signIn(AuditAction.SIGN_IN_FAILED, user.getUsername(), user.getId(), user.getRole().name(),
                    "Failed two-factor code for " + user.getUsername() + (lockedNow ? " (locked out for a while)" : ""), "Wrong two-factor code");
            throw new BadCredentialsException("That code is not right. Try the current code from your app, or a recovery code");
        }
        attempts.recordSuccess(key);
    }

    @Override
    @Transactional
    public AppUser reset(UUID targetId, UUID actingUserId) {
        if (targetId.equals(actingUserId)) {
            throw new IllegalStateException("You cannot reset your own two-factor sign-in; turn it off from your security page");
        }
        AppUser user = find(targetId);
        if (!user.isTwoFactorEnabled() && user.getTotpSecret() == null) {
            throw new IllegalStateException("This account has no two-factor sign-in to reset");
        }
        clear(user);
        user.setTokenVersion(user.getTokenVersion() + 1);   // signs them out everywhere
        AppUser saved = users.save(user);
        audit.action(AuditAction.ACCOUNT_UPDATED, AuditEntity.ACCOUNT, saved.getId(), AuditSnapshots.label(saved),
                "Reset two-factor sign-in of " + saved.getUsername(), null);
        events.publishEvent(new NotificationEvents.SecurityAlert(saved.getUsername(), "Two-factor sign-in was reset",
                "An administrator reset two-factor sign-in on your SmartHR account"
                        + (saved.getRole().requiresTwoFactor() ? ". You will be asked to set it up again the next time you sign in." : ".")));
        return saved;
    }

    private void confirmPasswordAndCode(AppUser user, String password, String code) {
        String key = "2fa-manage:" + user.getId();
        attempts.checkNotLocked(key);
        if (password == null || !encoder.matches(password, user.getPasswordHash())) {
            attempts.recordFailure(key);
            throw new FieldValidationException("password", "Password is incorrect");
        }
        try {
            acceptCode(user, code, "code");
        } catch (FieldValidationException e) {
            attempts.recordFailure(key);
            throw e;
        }
        attempts.recordSuccess(key);
    }

    /** Checks an authenticator code against the user's secret and remembers its time step so it cannot be replayed. */
    private void acceptCode(AppUser user, String code, String field) {
        if (user.getTotpSecret() == null) {
            throw new FieldValidationException(field, "Two-factor sign-in is not set up");
        }
        long step = Totp.verify(user.getTotpSecret(), code == null ? "" : code.replaceAll("\\s", ""),
                user.getLastTotpStep() == null ? -1 : user.getLastTotpStep());
        if (step < 0) {
            throw new FieldValidationException(field, "That code is not right or has expired");
        }
        user.setLastTotpStep(step);
        users.save(user);
    }

    private void useRecoveryCode(AppUser user, String typed) {
        String hash = hash(typed.toUpperCase());
        List<String> left = split(user.getRecoveryCodeHashes());
        // compare against every hash so the time taken does not show which one matched
        boolean found = false;
        List<String> remaining = new ArrayList<>();
        for (String stored : left) {
            if (MessageDigest.isEqual(stored.getBytes(StandardCharsets.UTF_8), hash.getBytes(StandardCharsets.UTF_8))) {
                found = true;
            } else {
                remaining.add(stored);
            }
        }
        if (!found) {
            throw new FieldValidationException("code", "That recovery code is not right or was already used");
        }
        user.setRecoveryCodeHashes(String.join(",", remaining));
        users.save(user);
        audit.action(AuditAction.ACCOUNT_UPDATED, AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user),
                user.getUsername() + " signed in with a recovery code (" + remaining.size() + " left)", null);
        events.publishEvent(new NotificationEvents.SecurityAlert(user.getUsername(), "A recovery code was used to sign in",
                "A one-time recovery code was just used to sign in to your SmartHR account. " + remaining.size()
                        + " recovery codes are left. If this was not you, change your password at once."));
    }

    private List<String> newRecoveryCodes(AppUser user) {
        List<String> codes = new ArrayList<>();
        List<String> hashes = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODES; i++) {
            StringBuilder code = new StringBuilder();
            for (int j = 0; j < 10; j++) {
                code.append(RECOVERY_ALPHABET.charAt(RANDOM.nextInt(RECOVERY_ALPHABET.length())));
            }
            codes.add(code.substring(0, 5) + "-" + code.substring(5));
            hashes.add(hash(code.toString()));
        }
        user.setRecoveryCodeHashes(String.join(",", hashes));
        return codes;
    }

    private void clear(AppUser user) {
        user.setTwoFactorEnabled(false);
        user.setTotpSecret(null);
        user.setLastTotpStep(null);
        user.setRecoveryCodeHashes(null);
    }

    private static List<String> split(String hashes) {
        return hashes == null || hashes.isBlank() ? List.of() : Arrays.asList(hashes.split(","));
    }

    private static String hash(String recoveryCode) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(recoveryCode.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private AppUser find(UUID id) {
        return users.findById(id).orElseThrow(() -> new ResourceNotFoundException("Account", id));
    }
}
