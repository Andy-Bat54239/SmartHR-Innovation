package rw.ac.auca.google;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.security.JwtService;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.dto.LoginResponse;
import rw.ac.auca.user.dto.UserResponse;
import rw.ac.auca.user.repository.AppUserRepository;
import rw.ac.auca.user.service.UserService;

import java.util.Locale;

/**
 * Decides what a verified Google identity may do in SmartHR. Google only proves who somebody is; SmartHR still decides if
 * they may come in. Accounts are never created from a Google sign-in: an administrator creates the account first (its username
 * is the person's email address), and Google then works as a way to sign in to it.
 */
@Service
public class GoogleSignInService {

    @Autowired
    private AppUserRepository users;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuditService audit;

    /**
     * The same answer a password login gives: a finished login, or (when the account uses two-factor sign-in) a challenge
     * to finish with a code. Throws {@link GoogleSignInException} with a message fit for the login page otherwise.
     */
    public LoginResponse signIn(String email, boolean emailVerified) {
        String key = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (key.isEmpty() || !emailVerified) {
            fail(key.isEmpty() ? "unknown" : key, null, "Google did not confirm this email address");
            throw new GoogleSignInException("Google has not confirmed your email address, so you cannot sign in with it.");
        }
        AppUser user = users.findByUsername(key).orElse(null);
        if (user == null) {
            fail(key, null, "No account for this Google email");
            throw new GoogleSignInException("There is no SmartHR account for " + key + ". Ask an administrator to create one with this email address.");
        }
        if (!user.isEnabled()) {
            fail(key, user, "The account is switched off");
            throw new GoogleSignInException("This account is switched off. Ask an administrator.");
        }
        if (user.isMustChangePassword()) {
            // the temporary password is still valid: it has to be replaced first, or Google would sidestep that
            fail(key, user, "A temporary password has not been replaced yet");
            throw new GoogleSignInException("Sign in once with your temporary password and choose your own password first. After that you can use Google.");
        }
        if (user.isTwoFactorEnabled()) {
            return LoginResponse.challenge(jwtService.issueChallenge(user));
        }
        userService.completeSignIn(user, "Signed in with Google");
        JwtService.IssuedToken token = jwtService.issueFor(user);
        return LoginResponse.signedIn(token.value(), token.expiresAt(), UserResponse.from(user));
    }

    private void fail(String email, AppUser user, String reason) {
        audit.signIn(AuditAction.SIGN_IN_FAILED, email, user == null ? null : user.getId(), user == null ? null : user.getRole().name(),
                "Failed Google sign-in as " + email, reason);
    }
}
