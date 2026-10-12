package rw.ac.auca.notification;

/** Sends one email through the SMTP server. Called by the queue's consumer, which retries when it fails. */
public interface EmailService {

    /** Whether real mail goes out (SMTP is configured); otherwise emails are only written to the log. */
    boolean isConfigured();

    /**
     * Sends the email, or, when no SMTP server is configured, writes it to the log.
     * Throws when the mail server refuses or cannot be reached, so the caller can retry.
     */
    void deliver(EmailMessage message);
}
