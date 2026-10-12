package rw.ac.auca.user.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;
import rw.ac.auca.employee.domain.Employee;

/**
 * A login. The table is called app_user because "user" is a reserved word in PostgreSQL.
 * Responses never expose this entity: the API sends UserResponse, which has no password.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "app_user")
public class AppUser extends BaseEntity {

    /** The login name: an email address, stored lower case. */
    @Column(name = "username", nullable = false, unique = true, length = 150)
    private String username;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    /** True after an administrator sets or resets the password: it must be replaced at the next login. */
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    /**
     * Stamped into every token. Changing the password bumps it, which ends every earlier login at once.
     */
    @Column(name = "token_version", nullable = false)
    private int tokenVersion;

    /** The Base32 secret of the authenticator app. Set while setting up, and only used once {@link #twoFactorEnabled} is true. */
    @JsonIgnore
    @Column(name = "totp_secret", length = 64)
    private String totpSecret;

    /** True once the person has proved they can produce a code: from then on signing in also needs one. */
    @Column(name = "two_factor_enabled", nullable = false, columnDefinition = "boolean default false")
    private boolean twoFactorEnabled;

    /** The last 30-second step whose code was accepted: a code cannot be used twice. */
    @JsonIgnore
    @Column(name = "last_totp_step")
    private Long lastTotpStep;

    /** SHA-256 hashes (hex, comma separated) of the one-time recovery codes that have not been used yet. */
    @JsonIgnore
    @Column(name = "recovery_code_hashes", length = 1000)
    private String recoveryCodeHashes;

    /** Whether to email about leave requests and trainings. Security alerts (password, two-factor) are always sent. */
    @Column(name = "email_notifications", nullable = false, columnDefinition = "boolean default true")
    private boolean emailNotifications = true;

    /** The person this account belongs to. Required for EMPLOYEE accounts; one employee has at most one account. */
    @OneToOne
    @JoinColumn(name = "employee_id", unique = true)
    private Employee employee;
}
