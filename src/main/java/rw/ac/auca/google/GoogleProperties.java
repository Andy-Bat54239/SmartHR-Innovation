package rw.ac.auca.google;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * "smarthr.google" in application.properties: the credentials of the OAuth client created in the Google Cloud console.
 * Without a client id the Google button is not offered and nothing else changes.
 */
@ConfigurationProperties(prefix = "smarthr.google")
public record GoogleProperties(String clientId, String clientSecret, String frontendUrl) {

    public GoogleProperties {
        if (clientId == null) clientId = "";
        if (clientSecret == null) clientSecret = "";
        if (frontendUrl == null || frontendUrl.isBlank()) frontendUrl = "http://localhost:5173";
    }

    public boolean enabled() {
        return !clientId.isBlank() && !clientSecret.isBlank();
    }
}
