package rw.ac.auca.google;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.util.UriComponentsBuilder;
import rw.ac.auca.user.dto.LoginResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * "Continue with Google": the OAuth2 / OpenID Connect authorization code flow, run by Spring Security.
 * <pre>
 *   browser ──► GET /oauth2/authorization/google ──► Google (the person signs in there, SmartHR never sees the password)
 *   Google  ──► GET /login/oauth2/code/google?code=… ──► Spring exchanges the code for an ID token and checks it
 *   SmartHR ──► redirect to the web app: /auth/google/callback?code=<one-time code>   (or ?error=…)
 *   web app ──► POST /auth/google/exchange {code} ──► the usual login (or a two-factor challenge)
 * </pre>
 * It lives in a filter chain of its own that may keep a short-lived session cookie (Spring needs it to remember the
 * "state" between leaving for Google and coming back). The API itself stays stateless. Nothing here exists unless
 * {@code smarthr.google.client-id} and {@code smarthr.google.client-secret} are set.
 */
@Configuration
@EnableConfigurationProperties(GoogleProperties.class)
public class GoogleOAuthConfig {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthConfig.class);

    @Autowired
    private GoogleProperties properties;

    @Bean
    ClientRegistrationRepository googleClientRegistrations() {
        if (!properties.enabled()) {
            // an empty repository: the beans below stay, but no provider can be chosen
            return registrationId -> null;
        }
        ClientRegistration google = CommonOAuth2Provider.GOOGLE.getBuilder("google")
                .clientId(properties.clientId())
                .clientSecret(properties.clientSecret())
                .scope("openid", "profile", "email")
                .build();
        return new InMemoryClientRegistrationRepository(google);
    }

    @Bean
    @Order(1)
    SecurityFilterChain googleFilterChain(HttpSecurity http, GoogleSignInService signIn, GoogleLoginCodes codes) throws Exception {
        http
                .securityMatcher("/oauth2/**", "/login/oauth2/**")
                .csrf(AbstractHttpConfigurer::disable)      // only GET requests that Google's redirect answers
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        if (properties.enabled()) {
            http.oauth2Login(login -> login
                    .clientRegistrationRepository(googleClientRegistrations())
                    .successHandler((request, response, authentication) -> onSuccess(request, response, authentication, signIn, codes))
                    .failureHandler((request, response, exception) -> {
                        log.warn("Google sign-in failed: {}", exception.getMessage());
                        redirect(request, response, "error", "Google sign-in did not work. Try again, or sign in with your password.");
                    }));
        }
        return http.build();
    }

    private void onSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication,
                           GoogleSignInService signIn, GoogleLoginCodes codes) throws IOException {
        // the session was only there to remember the state; it is not a login
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        try {
            if (!(authentication.getPrincipal() instanceof OidcUser google)) {
                throw new GoogleSignInException("Google did not send the details SmartHR needs.");
            }
            LoginResponse login = signIn.signIn(google.getEmail(), Boolean.TRUE.equals(google.getEmailVerified()));
            redirect(request, response, "code", codes.store(login));
        } catch (GoogleSignInException e) {
            redirect(request, response, "error", e.getMessage());
        }
    }

    private void redirect(HttpServletRequest request, HttpServletResponse response, String name, String value) throws IOException {
        String target = UriComponentsBuilder.fromUriString(properties.frontendUrl())
                .path("/auth/google/callback")
                .queryParam(name, value)
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUriString();
        response.sendRedirect(target);
    }
}
