package rw.ac.auca.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** "smarthr.mail" in application.properties. The SMTP server itself is set with the usual "spring.mail.*" settings. */
@ConfigurationProperties(prefix = "smarthr.mail")
public record MailProperties(String from, String appUrl, Boolean enabled, Integer reminderDaysBefore) {

    public MailProperties {
        if (from == null || from.isBlank()) from = "SmartHR <no-reply@smarthr.local>";
        if (appUrl == null || appUrl.isBlank()) appUrl = "http://localhost:5173";
        if (enabled == null) enabled = true;
        if (reminderDaysBefore == null) reminderDaysBefore = 1;
    }
}
