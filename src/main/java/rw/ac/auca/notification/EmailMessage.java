package rw.ac.auca.notification;

/** One email waiting to be sent: what travels through the queue (as JSON). */
public record EmailMessage(String to, String subject, String headline, String body, String buttonLabel, String buttonPath) {
}
