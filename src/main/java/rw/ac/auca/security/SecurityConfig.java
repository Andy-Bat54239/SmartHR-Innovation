package rw.ac.auca.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Who may call what.
 * <pre>
 *   public        POST /auth/login, the API docs
 *   any account   /auth/**, /me/**   (your own profile, leave requests and trainings)
 *   ADMIN         /user/**, /audit/** (accounts, and the audit trail)
 *   HR or ADMIN   employees, departments, locations, trainings, leave requests, dashboard
 * </pre>
 * The API is stateless: there is no session, every request carries its token.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);
    private static final String DEV_SECRET_PREFIX = "dev-only-secret";

    @Autowired
    private SecurityProperties properties;

    @PostConstruct
    void checkSecret() {
        if (properties.jwtSecret() == null || properties.jwtSecret().getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("smarthr.security.jwt-secret must be at least 32 characters long");
        }
        if (properties.jwtSecret().startsWith(DEV_SECRET_PREFIX)) {
            log.warn("Login tokens are signed with the built-in development secret. "
                    + "Set SMARTHR_JWT_SECRET to a long random value before using this anywhere but your own machine.");
        }
    }

    private SecretKey signingKey() {
        return new SecretKeySpec(properties.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(signingKey()));
    }

    @Bean
    JwtDecoder jwtDecoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(signingKey()).macAlgorithm(MacAlgorithm.HS256).build();
        // checks the expiry and that we issued it
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(JwtService.ISSUER));
        return decoder;
    }

    /** Which browser origins may call the API: the React dev server, its production preview, and port 3000. */
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:4173", "http://localhost:3000"));
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        cors.setExposedHeaders(List.of("Retry-After"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)   // after the Google sign-in chain, which only answers /oauth2/** and /login/oauth2/**
    SecurityFilterChain filterChain(HttpSecurity http, JwtDecoder decoder, JwtUserConverter converter, ApiErrorWriter errors) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) -> {
            boolean hadToken = request.getHeader(HttpHeaders.AUTHORIZATION) != null;
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
            errors.write(response, HttpStatus.UNAUTHORIZED,
                    hadToken ? "Your session has expired or is no longer valid. Sign in again." : "Sign in to continue",
                    null, request.getRequestURI());
        };
        AccessDeniedHandler accessDenied = (request, response, exception) ->
                errors.write(response, HttpStatus.FORBIDDEN, "You do not have permission to do that", null, request.getRequestURI());

        http
                .csrf(AbstractHttpConfigurer::disable)            // no cookies are used, so there is nothing to forge
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login", "/auth/login/2fa", "/auth/google/exchange").permitAll()
                        .requestMatchers(HttpMethod.GET, "/auth/providers").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/auth/**", "/me/**", "/me").authenticated()
                        .requestMatchers("/user/**", "/audit/**", "/notification/**").hasRole("ADMIN")
                        .requestMatchers("/employee/**", "/employee-profile/**", "/department/**", "/location/**",
                                "/training/**", "/leave/**", "/dashboard/**").hasAnyRole("HR", "ADMIN")
                        // anything else, including routes that do not exist, needs a login but no particular role
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(converter))
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(accessDenied))
                .exceptionHandling(handling -> handling.authenticationEntryPoint(entryPoint).accessDeniedHandler(accessDenied))
                .addFilterAfter(new PasswordChangeRequiredFilter(errors), BearerTokenAuthenticationFilter.class)
                .addFilterAfter(new TwoFactorSetupRequiredFilter(errors), PasswordChangeRequiredFilter.class);
        return http.build();
    }
}
