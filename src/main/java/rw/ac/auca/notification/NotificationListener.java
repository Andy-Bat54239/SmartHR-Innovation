package rw.ac.auca.notification;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.leave_request.domain.LeaveType;
import rw.ac.auca.notification.NotificationEvents.LeaveDecided;
import rw.ac.auca.notification.NotificationEvents.LeaveSubmitted;
import rw.ac.auca.notification.NotificationEvents.SecurityAlert;
import rw.ac.auca.notification.NotificationEvents.TrainingEnrolled;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.domain.Role;
import rw.ac.auca.user.repository.AppUserRepository;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Turns events into emails once the change that caused them is saved, on a background thread so the request that
 * triggered them does not wait for the mail server. Leave and training emails respect each account's switch;
 * security alerts always go out.
 */
@Component
public class NotificationListener {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    @Autowired
    private EmailQueue queue;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private EmployeeRepository employees;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSecurityAlert(SecurityAlert event) {
        queue.enqueue(new EmailMessage(event.to(), event.subject(), event.subject(), event.message(), "Open your security page", "/security"));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onLeaveSubmitted(LeaveSubmitted event) {
        String body = event.employeeName() + " asked for " + kind(event.type()) + " leave from " + day(event.start()) + " to " + day(event.end())
                + "." + (event.reason() == null || event.reason().isBlank() ? "" : "\n\nTheir reason: " + event.reason());
        for (AppUser decider : users.findByRoleInAndEnabledTrue(List.of(Role.HR, Role.ADMIN))) {
            // somebody who files their own request does not need an email about it
            boolean theirOwn = decider.getEmployee() != null && decider.getEmployee().getId().equals(event.employeeId());
            if (decider.isEmailNotifications() && !theirOwn) {
                queue.enqueue(new EmailMessage(decider.getUsername(), "Leave request from " + event.employeeName(), "A leave request is waiting for a decision", body,
                        "Review the request", "/leaves?status=PENDING"));
            }
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onLeaveDecided(LeaveDecided event) {
        String verdict = event.approved() ? "approved" : "rejected";
        String body = "Your " + kind(event.type()) + " leave from " + day(event.start()) + " to " + day(event.end()) + " was " + verdict + "."
                + (event.approved() || event.rejectionReason() == null ? "" : "\n\nReason: " + event.rejectionReason());
        notifyEmployee(event.employeeId(), "Your leave request was " + verdict, "Your leave request was " + verdict, body, "See my leave", "/my-leave");
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTrainingEnrolled(TrainingEnrolled event) {
        notifyEmployee(event.employeeId(), "You were enrolled in " + event.title(), "You were enrolled in a training", trainingText(event.title(), event.start(),
                event.end(), event.trainer()), "See my trainings", "/my-trainings");
    }

    /** Used by the daily reminder job too. */
    public void remindTraining(UUID employeeId, String title, LocalDate start, LocalDate end, String trainer, boolean tomorrow) {
        notifyEmployee(employeeId, title + (tomorrow ? " starts tomorrow" : " starts soon"), "A training you are enrolled in starts " + (tomorrow ? "tomorrow" : "soon"),
                trainingText(title, start, end, trainer), "See my trainings", "/my-trainings");
    }

    private void notifyEmployee(UUID employeeId, String subject, String headline, String body, String label, String path) {
        Employee employee = employees.findById(employeeId).orElse(null);
        AppUser account = users.findByEmployee_Id(employeeId).orElse(null);
        // an employee without a sign-in has no way to follow the link, and a switch means "no emails"
        if (employee == null || account == null || !account.isEnabled() || !account.isEmailNotifications()) return;
        queue.enqueue(new EmailMessage(employee.getEmail(), subject, headline, body, label, path));
    }

    private static String trainingText(String title, LocalDate start, LocalDate end, String trainer) {
        String when = start == null ? "dates to be announced" : end == null || end.equals(start) ? day(start) : day(start) + " to " + day(end);
        return title + "\n" + when + (trainer == null || trainer.isBlank() ? "" : "\nTrainer: " + trainer);
    }

    private static String kind(LeaveType type) {
        return type.name().toLowerCase(Locale.ENGLISH);
    }

    private static String day(LocalDate date) {
        return date == null ? "—" : date.format(DAY);
    }
}
