package rw.ac.auca.notification;

/** What an administrator sees of the email queue. {@code available} is false when RabbitMQ cannot be reached. */
public record EmailQueueStatus(boolean available, long waiting, long consumers, long dead) {
}
