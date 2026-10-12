package rw.ac.auca.notification;

import rw.ac.auca.leave_request.domain.LeaveType;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Things that happened which somebody may want an email about. Services publish them inside their transaction;
 * {@link NotificationListener} sends the email only after that transaction has committed, so nobody is told about
 * something that was rolled back. The events carry plain values, never entities.
 */
public final class NotificationEvents {

    private NotificationEvents() {
    }

    /** A sign-in or password matter that always goes to the account's own address, whatever its notification setting. */
    public record SecurityAlert(String to, String subject, String message) {
    }

    /** Someone asked for leave: HR and administrators hear about it. */
    public record LeaveSubmitted(UUID employeeId, String employeeName, LeaveType type, LocalDate start, LocalDate end, String reason) {
    }

    /** Leave was approved or rejected: the employee hears about it. */
    public record LeaveDecided(UUID employeeId, String employeeName, boolean approved, LeaveType type, LocalDate start, LocalDate end,
                               String rejectionReason) {
    }

    /** Someone was enrolled in a training: they hear about it. */
    public record TrainingEnrolled(UUID employeeId, String employeeName, String title, LocalDate start, LocalDate end, String trainer) {
    }
}
