package rw.ac.auca.user.service;

import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.dto.CreateUserRequest;
import rw.ac.auca.user.dto.UpdateUserRequest;

import java.util.List;
import java.util.UUID;

public interface UserService {

    /** An account together with the temporary password just generated for it. */
    record CreatedAccount(AppUser user, String temporaryPassword) {
    }

    /** Checks a username and password; every failure gives the same "incorrect" answer, and too many lock the account. */
    AppUser authenticate(String username, String password);

    /** Writes "signed in" to the audit trail; called once the whole sign-in (password, and the code if there is one) has succeeded. */
    void completeSignIn(AppUser user);

    /** The same, with a different sentence for the trail (for example "Signed in with Google"). */
    void completeSignIn(AppUser user, String summary);

    /** Switches emails about leave requests and trainings on or off for the account. */
    AppUser setEmailNotifications(UUID userId, boolean on);

    CreatedAccount createAccount(CreateUserRequest request);

    AppUser updateAccount(UUID id, UpdateUserRequest request, UUID actingUserId);

    /** Sets a new temporary password (which must be changed at the next login) and ends every earlier login. */
    CreatedAccount resetPassword(UUID id);

    void deleteAccount(UUID id, UUID actingUserId);

    AppUser findById(UUID id);

    List<AppUser> findAll();

    /** Checks the current password, sets the new one, and ends every earlier login. */
    AppUser changePassword(UUID userId, String currentPassword, String newPassword);

    /** Ends every login of the account, on every device, this one included: they all have to sign in again. */
    void signOutEverywhere(UUID userId);

    /** Removes the account of an employee who is being deleted, refusing if it is the last active administrator. */
    void removeAccountOf(UUID employeeId);
}
