package rw.ac.auca.leave_request.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code PATCH /leave/{id}/reject}: rejecting a leave request always needs a reason. */
public record RejectionRequest(
        @NotBlank(message = "Give a reason for rejecting this request")
        @Size(max = 1000, message = "Reason must be at most 1000 characters")
        String reason) {
}
