package rw.ac.auca.user.domain;

/**
 * What an account may do:
 * <ul>
 *   <li>ADMIN: everything HR can do, and manages the accounts</li>
 *   <li>HR: employees, departments, locations, trainings, leave requests and the dashboard</li>
 *   <li>EMPLOYEE: only their own profile, leave requests and trainings</li>
 * </ul>
 */
public enum Role {
    ADMIN,
    HR,
    EMPLOYEE;

    /** Administrators can change everything, so they must sign in with a second factor; the others may choose to. */
    public boolean requiresTwoFactor() {
        return this == ADMIN;
    }
}
