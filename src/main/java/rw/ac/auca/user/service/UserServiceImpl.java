package rw.ac.auca.user.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import rw.ac.auca.notification.NotificationEvents;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.exception.DuplicateResourceException;
import rw.ac.auca.exception.FieldValidationException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.security.LoginAttempts;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.domain.Role;
import rw.ac.auca.user.dto.CreateUserRequest;
import rw.ac.auca.user.dto.UpdateUserRequest;
import rw.ac.auca.user.repository.AppUserRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class UserServiceImpl implements UserService {

    // BCrypt only looks at the first 72 bytes of a password
    private static final int MAX_PASSWORD_BYTES = 72;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private EmployeeRepository employees;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private LoginAttempts attempts;

    @Autowired
    private AuditService audit;

    @Autowired
    private ApplicationEventPublisher events;

    /** Compared against when the username does not exist, so a wrong username takes as long as a wrong password. */
    private String decoyHash;

    @PostConstruct
    void createDecoy() {
        decoyHash = encoder.encode("not-the-password-of-anyone");
    }

    @Override
    @Transactional(readOnly = true)
    public AppUser authenticate(String username, String password) {
        String key = normalize(username);
        attempts.checkNotLocked(key);

        AppUser user = users.findByUsername(key).orElse(null);
        boolean ok = matches(password, user == null ? decoyHash : user.getPasswordHash()) && user != null && user.isEnabled();
        if (!ok) {
            boolean lockedNow = attempts.recordFailure(key);
            // The trail says why (only administrators read it); the person trying is told nothing but "incorrect".
            String reason = user == null ? "Unknown username" : !user.isEnabled() ? "The account is switched off" : "Wrong password";
            audit.signIn(AuditAction.SIGN_IN_FAILED, key, null, null, "Failed sign-in as " + key, reason);
            if (lockedNow) {
                audit.signIn(AuditAction.SIGN_IN_FAILED, key, null, null, "Too many failed attempts: " + key + " is locked out for a while", null);
            }
            // one answer for unknown username, wrong password and disabled account
            throw new BadCredentialsException("Incorrect username or password");
        }
        attempts.recordSuccess(key);
        return user;
    }

    @Override
    public void completeSignIn(AppUser user) {
        completeSignIn(user, "Signed in");
    }

    @Override
    public void completeSignIn(AppUser user, String summary) {
        audit.signIn(AuditAction.SIGNED_IN, user.getUsername(), user.getId(), user.getRole().name(), summary, null);
    }

    @Override
    @Transactional
    public void signOutEverywhere(UUID userId) {
        AppUser user = findById(userId);
        user.setTokenVersion(user.getTokenVersion() + 1);   // every token carries the old number, so every token stops working
        users.save(user);
        audit.action(AuditAction.ACCOUNT_UPDATED, AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user),
                user.getUsername() + " signed out of every device", null);
        events.publishEvent(new NotificationEvents.SecurityAlert(user.getUsername(), "You were signed out everywhere",
                "Every login of your SmartHR account was ended, on all devices. If this was not you, change your password."));
    }

    @Override
    @Transactional
    public AppUser setEmailNotifications(UUID userId, boolean on) {
        AppUser user = findById(userId);
        user.setEmailNotifications(on);
        return users.save(user);
    }

    @Override
    @Transactional
    public CreatedAccount createAccount(CreateUserRequest request) {
        String username = normalize(request.username());
        if (users.existsByUsername(username)) {
            throw new DuplicateResourceException("username", "Username already in use: " + username);
        }
        Employee employee = resolveEmployee(request.role(), request.employeeId(), null);

        String temporary = PasswordGenerator.generate();
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(encoder.encode(temporary));
        user.setRole(request.role());
        user.setEnabled(true);
        user.setMustChangePassword(true);
        user.setEmployee(employee);
        AppUser saved = users.save(user);
        audit.created(AuditEntity.ACCOUNT, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        return new CreatedAccount(saved, temporary);
    }

    @Override
    @Transactional
    public AppUser updateAccount(UUID id, UpdateUserRequest request, UUID actingUserId) {
        AppUser user = findById(id);
        AuditSnapshot before = AuditSnapshots.of(user);
        boolean roleChanges = request.role() != user.getRole();
        boolean switchedOff = user.isEnabled() && !request.enabled();

        if (id.equals(actingUserId) && (roleChanges || switchedOff)) {
            throw new IllegalStateException("You cannot change your own role or switch off your own account");
        }
        if (user.getRole() == Role.ADMIN && user.isEnabled() && (roleChanges || switchedOff)) {
            ensureAnotherActiveAdmin();
        }
        user.setEmployee(resolveEmployee(request.role(), request.employeeId(), user));
        user.setRole(request.role());
        user.setEnabled(request.enabled());
        AppUser saved = users.save(user);
        audit.updated(AuditEntity.ACCOUNT, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public CreatedAccount resetPassword(UUID id) {
        AppUser user = findById(id);
        String temporary = PasswordGenerator.generate();
        user.setPasswordHash(encoder.encode(temporary));
        user.setMustChangePassword(true);
        user.setTokenVersion(user.getTokenVersion() + 1);   // signs them out everywhere
        AppUser saved = users.save(user);
        audit.action(AuditAction.PASSWORD_RESET, AuditEntity.ACCOUNT, saved.getId(), AuditSnapshots.label(saved),
                "Reset the password of " + saved.getUsername(), null);
        events.publishEvent(new NotificationEvents.SecurityAlert(saved.getUsername(), "Your password was reset",
                "An administrator reset the password of your SmartHR account. Ask them for the temporary password; you will choose your own when you sign in."));
        return new CreatedAccount(saved, temporary);
    }

    @Override
    @Transactional
    public void deleteAccount(UUID id, UUID actingUserId) {
        if (id.equals(actingUserId)) {
            throw new IllegalStateException("You cannot delete your own account");
        }
        AppUser user = findById(id);
        if (user.getRole() == Role.ADMIN && user.isEnabled()) {
            ensureAnotherActiveAdmin();
        }
        users.delete(user);
        audit.deleted(AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user), AuditSnapshots.of(user), null);
    }

    @Override
    @Transactional(readOnly = true)
    public AppUser findById(UUID id) {
        return users.findById(id).orElseThrow(() -> new ResourceNotFoundException("Account", id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppUser> findAll() {
        return users.findAll();
    }

    @Override
    @Transactional
    public AppUser changePassword(UUID userId, String currentPassword, String newPassword) {
        String key = "change-password:" + userId;
        attempts.checkNotLocked(key);

        AppUser user = findById(userId);
        if (!matches(currentPassword, user.getPasswordHash())) {
            attempts.recordFailure(key);
            throw new FieldValidationException("currentPassword", "Current password is incorrect");
        }
        attempts.recordSuccess(key);

        if (newPassword.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new FieldValidationException("newPassword", "New password is too long");
        }
        if (newPassword.equals(currentPassword)) {
            throw new FieldValidationException("newPassword", "Choose a password different from the current one");
        }
        if (newPassword.equalsIgnoreCase(user.getUsername())) {
            throw new FieldValidationException("newPassword", "The password cannot be your username");
        }
        user.setPasswordHash(encoder.encode(newPassword));
        user.setMustChangePassword(false);
        user.setTokenVersion(user.getTokenVersion() + 1);   // every older login stops working
        AppUser saved = users.save(user);
        audit.action(AuditAction.PASSWORD_CHANGED, AuditEntity.ACCOUNT, saved.getId(), AuditSnapshots.label(saved),
                saved.getUsername() + " changed their own password", null);
        events.publishEvent(new NotificationEvents.SecurityAlert(saved.getUsername(), "Your password was changed",
                "The password of your SmartHR account was just changed. If this was not you, ask an administrator to reset it at once."));
        return saved;
    }

    @Override
    @Transactional
    public void removeAccountOf(UUID employeeId) {
        users.findByEmployee_Id(employeeId).ifPresent(user -> {
            if (user.getRole() == Role.ADMIN && user.isEnabled() && users.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
                throw new IllegalStateException("This employee's account is the last active administrator, so they cannot be deleted");
            }
            audit.deleted(AuditEntity.ACCOUNT, user.getId(), AuditSnapshots.label(user), AuditSnapshots.of(user), "Deleted together with their employee record");
            users.delete(user);
            users.flush();
        });
    }

    /** The EMPLOYEE role must be tied to a person; other roles may be. One person has at most one account. */
    private Employee resolveEmployee(Role role, UUID employeeId, AppUser existing) {
        if (employeeId == null) {
            if (role == Role.EMPLOYEE) {
                throw new FieldValidationException("employeeId", "Choose the employee this account belongs to");
            }
            return null;
        }
        Employee employee = employees.findById(employeeId).orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));
        boolean takenByAnother = users.findByEmployee_Id(employeeId).filter(u -> existing == null || !u.getId().equals(existing.getId())).isPresent();
        if (takenByAnother) {
            throw new DuplicateResourceException("employeeId", "That employee already has an account");
        }
        return employee;
    }

    private void ensureAnotherActiveAdmin() {
        if (users.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
            throw new IllegalStateException("There must always be at least one active administrator");
        }
    }

    private boolean matches(String raw, String hash) {
        try {
            return encoder.matches(raw, hash);
        } catch (IllegalArgumentException tooLong) {
            return false;
        }
    }

    private String normalize(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
