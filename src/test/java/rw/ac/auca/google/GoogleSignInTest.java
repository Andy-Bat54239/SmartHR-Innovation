package rw.ac.auca.google;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import rw.ac.auca.smarthr.SmartHrApplication;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.domain.Role;
import rw.ac.auca.user.dto.LoginResponse;
import rw.ac.auca.user.repository.AppUserRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Google sign-in without Google: the redirect to Google is checked, and what SmartHR decides once Google has vouched for an
 * email address is checked directly. Runs on a scratch database (createdb smarthr_test); never sends mail or touches the real queues.
 */
@SpringBootTest(
        classes = SmartHrApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.url=jdbc:postgresql://localhost:5432/smarthr_test",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "smarthr.seed.enabled=false",
                "smarthr.mail.enabled=false",
                "smarthr.queue.prefix=smarthr.test.google",
                "smarthr.security.bootstrap-admin.password=Admin-Passw0rd-Test",
                "smarthr.google.client-id=test-client-id.apps.googleusercontent.com",
                "smarthr.google.client-secret=test-client-secret",
        })
class GoogleSignInTest {

    @LocalServerPort
    int port;

    @Autowired
    GoogleSignInService signIn;

    @Autowired
    GoogleLoginCodes codes;

    @Autowired
    AppUserRepository users;

    @Autowired
    PasswordEncoder encoder;

    private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = JsonMapper.builder().build();

    private AppUser account(String email, Role role, boolean enabled, boolean mustChange, boolean twoFactor) {
        AppUser user = new AppUser();
        user.setUsername(email);
        user.setPasswordHash(encoder.encode("Some-Passw0rd-1"));
        user.setRole(role);
        user.setEnabled(enabled);
        user.setMustChangePassword(mustChange);
        user.setTwoFactorEnabled(twoFactor);
        if (twoFactor) user.setTotpSecret("JBSWY3DPEHPK3PXP");
        return users.save(user);
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String body, String token) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        if (token != null) request.header("Authorization", "Bearer " + token);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void theLoginPageIsToldGoogleIsOn() throws Exception {
        HttpResponse<String> reply = get("/auth/providers");
        assertEquals(200, reply.statusCode());
        assertTrue(json.readTree(reply.body()).get("google").asBoolean());
    }

    @Test
    void theButtonSendsThePersonToGoogle() throws Exception {
        HttpResponse<String> reply = get("/oauth2/authorization/google");
        assertEquals(302, reply.statusCode());
        String location = reply.headers().firstValue("Location").orElse("");
        assertTrue(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), location);
        assertTrue(location.contains("client_id=test-client-id.apps.googleusercontent.com"), location);
        assertTrue(location.contains("scope=openid%20profile%20email") || location.contains("scope=openid+profile+email"), location);
        assertTrue(location.contains("redirect_uri=http://localhost:" + port + "/login/oauth2/code/google"), location);
        assertTrue(location.contains("state="), "the state protects against forged callbacks: " + location);
        assertTrue(location.contains("nonce="), "and the nonce binds the ID token to this sign-in: " + location);
    }

    @Test
    void aVerifiedGoogleEmailSignsInToTheMatchingAccount() {
        account("grace@example.com", Role.HR, true, false, false);
        LoginResponse login = signIn.signIn("Grace@Example.com", true);   // case does not matter
        assertFalse(login.twoFactorRequired());
        assertNotNull(login.token());
        assertEquals("grace@example.com", login.user().username());
    }

    @Test
    void anAccountWithTwoFactorStillNeedsItsCode() {
        account("secure@example.com", Role.ADMIN, true, false, true);
        LoginResponse login = signIn.signIn("secure@example.com", true);
        assertTrue(login.twoFactorRequired());
        assertEquals(null, login.token(), "no login before the code");
        assertNotNull(login.challengeToken());
    }

    @Test
    void whoMayNotComeInIsRefusedInPlainWords() {
        account("off@example.com", Role.HR, false, false, false);
        account("temp@example.com", Role.HR, true, true, false);
        assertTrue(assertThrows(GoogleSignInException.class, () -> signIn.signIn("nobody@example.com", true)).getMessage().contains("no SmartHR account"));
        assertTrue(assertThrows(GoogleSignInException.class, () -> signIn.signIn("grace@example.com", false)).getMessage().contains("not confirmed"));
        assertTrue(assertThrows(GoogleSignInException.class, () -> signIn.signIn("off@example.com", true)).getMessage().contains("switched off"));
        assertTrue(assertThrows(GoogleSignInException.class, () -> signIn.signIn("temp@example.com", true)).getMessage().contains("temporary password"));
        assertThrows(GoogleSignInException.class, () -> signIn.signIn(null, true));
        assertThrows(GoogleSignInException.class, () -> signIn.signIn("", true));
    }

    @Test
    void theOneTimeCodeBuysTheLoginOnce() throws Exception {
        account("once@example.com", Role.HR, true, false, false);
        String code = codes.store(signIn.signIn("once@example.com", true));

        HttpResponse<String> first = post("/auth/google/exchange", "{\"code\":\"" + code + "\"}", null);
        assertEquals(200, first.statusCode());
        JsonNode body = json.readTree(first.body());
        String token = body.get("token").asString();
        // the token is a real login
        HttpResponse<String> me = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/me"))
                .header("Authorization", "Bearer " + token).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, me.statusCode());

        assertEquals(400, post("/auth/google/exchange", "{\"code\":\"" + code + "\"}", null).statusCode(), "a code works once");
        assertEquals(400, post("/auth/google/exchange", "{\"code\":\"made-up\"}", null).statusCode());
    }
}
