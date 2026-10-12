package rw.ac.auca.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import rw.ac.auca.google.GoogleLoginCodes;
import rw.ac.auca.google.GoogleProperties;
import rw.ac.auca.google.GoogleSignInException;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import rw.ac.auca.security.AuthenticatedUser;
import rw.ac.auca.security.JwtService;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.dto.ChangePasswordRequest;
import rw.ac.auca.user.dto.LoginRequest;
import rw.ac.auca.user.dto.LoginResponse;
import rw.ac.auca.user.dto.TwoFactorDtos;
import rw.ac.auca.user.dto.UserResponse;
import rw.ac.auca.user.service.TwoFactorService;
import rw.ac.auca.user.service.UserService;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private TwoFactorService twoFactor;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private GoogleProperties googleProperties;

    @Autowired
    private GoogleLoginCodes googleCodes;

    /**
     * Step one of signing in: a username and password. An account with two-factor sign-in gets a challenge instead
     * of a token and finishes at {@code POST /auth/login/2fa}. The only other public endpoint.
     */
    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        AppUser user = userService.authenticate(request.username(), request.password());
        if (user.isTwoFactorEnabled()) {
            return LoginResponse.challenge(jwtService.issueChallenge(user));
        }
        return finish(user);
    }

    /** Step two: the challenge from step one and a current code from the authenticator app (or an unused recovery code). */
    @PostMapping("/login/2fa")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse loginWithCode(@Valid @RequestBody TwoFactorDtos.LoginRequest request) {
        JwtService.Challenge challenge = jwtService.verifyChallenge(request.challengeToken());
        AppUser user = userService.findById(challenge.userId());
        // a password change or a reset since step one, or an account switched off in between, ends the attempt
        if (!user.isEnabled() || !user.isTwoFactorEnabled() || user.getTokenVersion() != challenge.version()) {
            throw new BadCredentialsException("Your sign-in is no longer valid. Sign in again.");
        }
        twoFactor.verifyLogin(user, request.code());
        return finish(userService.findById(user.getId()));
    }

    /**
     * Sets a new password. Every earlier token stops working, so the response carries a fresh one.
     * An account flagged "must change password" may call only this (and GET /me) until it has.
     */
    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse changePassword(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody ChangePasswordRequest request) {
        return finish(userService.changePassword(me.id(), request.currentPassword(), request.newPassword()), false);
    }

    /** Ends every login of the signed-in account on every device, this one too; the person signs in again. */
    @PostMapping("/sign-out-everywhere")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void signOutEverywhere(@AuthenticationPrincipal AuthenticatedUser me) {
        userService.signOutEverywhere(me.id());
    }

    /** Which extra ways to sign in are switched on, so the login page knows which buttons to show. Public. */
    @GetMapping("/providers")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Boolean> providers() {
        return Map.of("google", googleProperties.enabled());
    }

    /** The last step of "Continue with Google": swaps the one-time code from the redirect for the usual login (or a two-factor challenge). */
    @PostMapping("/google/exchange")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse exchangeGoogleCode(@Valid @RequestBody GoogleExchangeRequest request) {
        return googleCodes.redeem(request.code());
    }

    public record GoogleExchangeRequest(@NotBlank(message = "The code is missing") @Size(max = 200) String code) {
    }

    // ---- two-factor sign-in: any signed-in account, also while an administrator still has to set it up ----

    @GetMapping("/2fa")
    @ResponseStatus(HttpStatus.OK)
    public TwoFactorDtos.Status twoFactorStatus(@AuthenticationPrincipal AuthenticatedUser me) {
        AppUser user = userService.findById(me.id());
        return new TwoFactorDtos.Status(user.isTwoFactorEnabled(), user.getRole().requiresTwoFactor(), twoFactor.recoveryCodesLeft(user));
    }

    /** Makes a secret for the authenticator app (shown as a QR code). Nothing changes for sign-in until {@code /2fa/enable}. */
    @PostMapping("/2fa/setup")
    @ResponseStatus(HttpStatus.OK)
    public TwoFactorDtos.SetupResponse setup(@AuthenticationPrincipal AuthenticatedUser me) {
        TwoFactorService.Setup setup = twoFactor.beginSetup(me.id());
        return new TwoFactorDtos.SetupResponse(setup.secret(), setup.otpauthUri());
    }

    /** Turns two-factor sign-in on after a first code proves the app works. The recovery codes in the answer are shown only once. */
    @PostMapping("/2fa/enable")
    @ResponseStatus(HttpStatus.OK)
    public TwoFactorDtos.RecoveryCodes enable(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody TwoFactorDtos.CodeRequest request) {
        return new TwoFactorDtos.RecoveryCodes(twoFactor.enable(me.id(), request.code()));
    }

    /** Turns it off again (password and a current code). Administrators cannot: it is required for their role. */
    @PostMapping("/2fa/disable")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disable(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody TwoFactorDtos.ConfirmRequest request) {
        twoFactor.disable(me.id(), request.password(), request.code());
    }

    @PostMapping("/2fa/recovery-codes")
    @ResponseStatus(HttpStatus.OK)
    public TwoFactorDtos.RecoveryCodes newRecoveryCodes(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody TwoFactorDtos.ConfirmRequest request) {
        return new TwoFactorDtos.RecoveryCodes(twoFactor.regenerateRecoveryCodes(me.id(), request.password(), request.code()));
    }

    private LoginResponse finish(AppUser user) {
        return finish(user, true);
    }

    private LoginResponse finish(AppUser user, boolean signIn) {
        if (signIn) {
            userService.completeSignIn(user);
        }
        JwtService.IssuedToken token = jwtService.issueFor(user);
        return LoginResponse.signedIn(token.value(), token.expiresAt(), UserResponse.from(user));
    }
}
