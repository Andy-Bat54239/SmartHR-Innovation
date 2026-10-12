package rw.ac.auca.notification;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;

/**
 * Sends through the SMTP server from "spring.mail.*". When none is configured (or "smarthr.mail.enabled=false") the
 * email is written to the log instead, so the rest of the app behaves the same on a development machine.
 */
@Service
public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final MailProperties properties;
    private final String smtpHost;

    @Autowired
    public SmtpEmailService(ObjectProvider<JavaMailSender> sender, MailProperties properties, @Value("${spring.mail.host:}") String smtpHost) {
        this.sender = sender;
        this.properties = properties;
        this.smtpHost = smtpHost;
    }

    @Override
    public boolean isConfigured() {
        // Spring Boot also builds a sender for an empty host, so the host itself is checked
        return properties.enabled() && !smtpHost.isBlank() && sender.getIfAvailable() != null;
    }

    @Override
    public void deliver(EmailMessage email) {
        if (email.to() == null || email.to().isBlank()) return;
        if (!isConfigured()) {
            log.info("Email not sent (no SMTP server configured). To: {} | Subject: {} | {} | {}", email.to(), email.subject(), email.headline(), email.body());
            return;
        }
        try {
            JavaMailSender mailSender = sender.getObject();
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.from());
            helper.setTo(email.to());
            helper.setSubject(email.subject());
            helper.setText(plain(email.headline(), email.body(), email.buttonPath()), html(email.headline(), email.body(), email.buttonLabel(), email.buttonPath()));
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            // never the body: it can hold names and reasons that do not belong in a log
            log.warn("Could not send the email \"{}\" to {}: {}", email.subject(), email.to(), e.getMessage());
            throw new IllegalStateException("The mail server did not accept the email: " + e.getMessage(), e);
        }
    }

    private String link(String path) {
        return path == null ? null : properties.appUrl().replaceAll("/+$", "") + path;
    }

    private String plain(String headline, String body, String path) {
        return headline + "\n\n" + body + (path == null ? "" : "\n\n" + link(path)) + "\n\n-- SmartHR";
    }

    private String html(String headline, String body, String label, String path) {
        String button = path == null ? "" : "<p style=\"margin:24px 0 0\"><a href=\"" + HtmlUtils.htmlEscape(link(path))
                + "\" style=\"background:#0a7f78;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;"
                + "font-weight:600;display:inline-block\">" + HtmlUtils.htmlEscape(label == null ? "Open SmartHR" : label) + "</a></p>";
        return "<div style=\"font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f1f5f9;padding:24px\">"
                + "<div style=\"max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;color:#0f172a\">"
                + "<p style=\"margin:0 0 16px;font-weight:700;color:#0a7f78\">SmartHR</p>"
                + "<h1 style=\"font-size:18px;margin:0 0 12px\">" + HtmlUtils.htmlEscape(headline) + "</h1>"
                + "<div style=\"font-size:14px;line-height:1.6;color:#334155\">" + HtmlUtils.htmlEscape(body).replace("\n", "<br>") + "</div>"
                + button
                + "</div><p style=\"text-align:center;font-size:12px;color:#64748b\">You get this email because of your SmartHR account. "
                + "You can turn leave and training emails off on your Security page.</p></div>";
    }
}
