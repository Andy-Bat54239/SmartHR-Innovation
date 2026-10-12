package rw.ac.auca.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Username is required") @Size(max = 150, message = "Username must be at most 150 characters") String username,
        @NotBlank(message = "Password is required") @Size(max = 200, message = "Password must be at most 200 characters") String password) {
}
