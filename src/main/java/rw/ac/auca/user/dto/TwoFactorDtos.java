package rw.ac.auca.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** The small request and response bodies of the two-factor endpoints under /auth/2fa. */
public final class TwoFactorDtos {

    private TwoFactorDtos() {
    }

    /** Second step of signing in: the token from the first step and a code from the app (or a recovery code). */
    public record LoginRequest(
            @NotBlank(message = "Start signing in again") String challengeToken,
            @NotBlank(message = "Enter the code") @Size(max = 30, message = "That code is too long") String code) {
    }

    public record CodeRequest(@NotBlank(message = "Enter the code") @Size(max = 30, message = "That code is too long") String code) {
    }

    /** Changing the two-factor settings asks for the password and a current code again. */
    public record ConfirmRequest(
            @NotBlank(message = "Password is required") @Size(max = 200, message = "Password is too long") String password,
            @NotBlank(message = "Enter the code") @Size(max = 30, message = "That code is too long") String code) {
    }

    public record SetupResponse(String secret, String otpauthUri) {
    }

    public record RecoveryCodes(List<String> recoveryCodes) {
    }

    public record Status(boolean enabled, boolean required, int recoveryCodesLeft) {
    }

    public record NotificationSettings(boolean emailNotifications) {
    }
}
