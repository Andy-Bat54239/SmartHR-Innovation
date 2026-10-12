package rw.ac.auca.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import rw.ac.auca.smarthr.SmartHrApplication;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Signs in, sets up, uses, resets and turns off two-factor sign-in through the real HTTP API.
 * Needs PostgreSQL: it runs against a scratch database (schema created and dropped by the test), never the real one:
 * <pre>createdb -U postgres smarthr_test   # once
 * ./mvnw test -Dtest=TwoFactorFlowTest -Dtest.database=smarthr_test</pre>
 */
@SpringBootTest(
        classes = SmartHrApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.url=jdbc:postgresql://localhost:5432/${test.database:smarthr_test}",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "smarthr.seed.enabled=false",
                // never send real mail from a test, and keep to a queue of its own on the shared broker
                "smarthr.mail.enabled=false",
                "smarthr.queue.prefix=smarthr.test.flow",
                "smarthr.security.bootstrap-admin.username=admin@test.local",
                "smarthr.security.bootstrap-admin.password=Admin-Passw0rd-Test",
        })
class TwoFactorFlowTest {

    @LocalServerPort
    int port;

    @Value("${spring.datasource.url}")
    String datasourceUrl;

    private final HttpClient http = HttpClient.newHttpClient();
    private final JsonMapper json = JsonMapper.builder().build();

    private record Reply(int status, JsonNode body) {
    }

    private Reply call(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
        JsonNode node = response.body().isBlank() ? json.createObjectNode() : json.readTree(response.body());
        return new Reply(response.statusCode(), node);
    }

    private String obj(String... pairs) {
        StringBuilder out = new StringBuilder("{");
        for (int i = 0; i < pairs.length; i += 2) {
            out.append(i > 0 ? "," : "").append('"').append(pairs[i]).append("\":\"").append(pairs[i + 1]).append('"');
        }
        return out.append('}').toString();
    }

    /** The code the app would show, {@code offset} 30-second steps from now (the server accepts -1, 0 and +1). */
    private String code(String secret, int offset) {
        return Totp.codeFor(secret, Instant.now().getEpochSecond() / 30 + offset);
    }

    @Test
    void theWholeJourney() throws Exception {
        assertTrue(datasourceUrl.contains("smarthr_test") || datasourceUrl.contains("test"),
                "this test creates and drops tables: it must never run against the real database (" + datasourceUrl + ")");
        String adminPassword = "Admin-Passw0rd-Test";

        // --- an administrator without two-factor sign-in gets in, but can do nothing except set it up ---
        Reply login = call("POST", "/auth/login", null, obj("username", "admin@test.local", "password", adminPassword));
        assertEquals(200, login.status());
        String token = login.body().get("token").asString();
        assertTrue(login.body().get("user").get("twoFactorSetupRequired").asBoolean());
        Reply blocked = call("GET", "/employee/search-all", token, null);
        assertEquals(403, blocked.status());
        assertEquals("TWO_FACTOR_SETUP_REQUIRED", blocked.body().get("code").asString());
        assertEquals(200, call("GET", "/me", token, null).status());
        // changing the password is still allowed (it was once blocked by mistake): it hands out a fresh token
        Reply newPassword = call("POST", "/auth/change-password", token, obj("currentPassword", adminPassword, "newPassword", "Admin-Passw0rd-Test2"));
        assertEquals(200, newPassword.status(), "an administrator without two-factor can still change the password");
        adminPassword = "Admin-Passw0rd-Test2";
        token = newPassword.body().get("token").asString();
        assertEquals(403, call("GET", "/employee/search-all", token, null).status(), "still blocked from everything else");

        // --- set it up: a wrong first code is refused, a right one turns it on and returns 10 recovery codes ---
        Reply setup = call("POST", "/auth/2fa/setup", token, null);
        assertEquals(200, setup.status());
        String secret = setup.body().get("secret").asString();
        assertTrue(setup.body().get("otpauthUri").asString().startsWith("otpauth://totp/SmartHR:"));
        assertEquals(400, call("POST", "/auth/2fa/enable", token, obj("code", "000000".equals(code(secret, -1)) ? "111111" : "000000")).status());
        Reply enabled = call("POST", "/auth/2fa/enable", token, obj("code", code(secret, -1)));
        assertEquals(200, enabled.status());
        JsonNode recovery = enabled.body().get("recoveryCodes");
        assertEquals(10, recovery.size());
        assertEquals(200, call("GET", "/employee/search-all", token, null).status(), "set up: the block is gone");

        // an administrator cannot turn it off again
        assertEquals(409, call("POST", "/auth/2fa/disable", token, obj("password", adminPassword, "code", code(secret, 1))).status());

        // --- signing in now needs the second step ---
        Reply first = call("POST", "/auth/login", null, obj("username", "admin@test.local", "password", adminPassword));
        assertEquals(200, first.status());
        assertTrue(first.body().get("twoFactorRequired").asBoolean());
        assertTrue(first.body().get("token").isNull(), "no token before the code");
        String challenge = first.body().get("challengeToken").asString();
        assertNotNull(challenge);
        // the challenge is not a login token
        assertEquals(401, call("GET", "/me", challenge, null).status());
        // a login token is not a challenge
        assertEquals(401, call("POST", "/auth/login/2fa", null, obj("challengeToken", token, "code", code(secret, 0))).status());
        // a wrong code
        assertEquals(401, call("POST", "/auth/login/2fa", null, obj("challengeToken", challenge, "code", "123456".equals(code(secret, 0)) ? "654321" : "123456")).status());
        // the right code
        String rightNow = code(secret, 0);
        Reply second = call("POST", "/auth/login/2fa", null, obj("challengeToken", challenge, "code", rightNow));
        assertEquals(200, second.status());
        String adminToken = second.body().get("token").asString();
        assertTrue(second.body().get("user").get("twoFactorEnabled").asBoolean());
        assertEquals(200, call("GET", "/user/search-all", adminToken, null).status());
        // the same code cannot be used twice
        assertEquals(401, call("POST", "/auth/login/2fa", null, obj("challengeToken", challenge, "code", rightNow)).status());

        // --- a recovery code works once ---
        String recoveryCode = recovery.get(0).asString();
        String challenge2 = call("POST", "/auth/login", null, obj("username", "admin@test.local", "password", adminPassword)).body().get("challengeToken").asString();
        assertEquals(200, call("POST", "/auth/login/2fa", null, obj("challengeToken", challenge2, "code", recoveryCode)).status());
        String challenge3 = call("POST", "/auth/login", null, obj("username", "admin@test.local", "password", adminPassword)).body().get("challengeToken").asString();
        assertEquals(401, call("POST", "/auth/login/2fa", null, obj("challengeToken", challenge3, "code", recoveryCode)).status(), "used up");
        assertEquals(9, call("GET", "/auth/2fa", adminToken, null).body().get("recoveryCodesLeft").asInt());

        // new recovery codes need the password and a current code, and replace the old ones
        assertEquals(400, call("POST", "/auth/2fa/recovery-codes", adminToken, obj("password", "wrong-password", "code", code(secret, 1))).status());
        Reply fresh = call("POST", "/auth/2fa/recovery-codes", adminToken, obj("password", adminPassword, "code", code(secret, 1)));
        assertEquals(200, fresh.status());
        assertEquals(10, call("GET", "/auth/2fa", adminToken, null).body().get("recoveryCodesLeft").asInt());

        // --- an HR account may turn it on and off, and an administrator can reset it ---
        Reply created = call("POST", "/user/create", adminToken, obj("username", "hr@test.local", "role", "HR"));
        assertEquals(200, created.status());
        String hrId = created.body().get("user").get("id").asString();
        String temporary = created.body().get("temporaryPassword").asString();
        Reply hrLogin = call("POST", "/auth/login", null, obj("username", "hr@test.local", "password", temporary));
        Reply changed = call("POST", "/auth/change-password", hrLogin.body().get("token").asString(),
                obj("currentPassword", temporary, "newPassword", "Hr-Passw0rd-Test"));
        assertEquals(200, changed.status());
        String hrToken = changed.body().get("token").asString();
        assertFalse(changed.body().get("user").get("twoFactorSetupRequired").asBoolean(), "optional for HR");
        assertEquals(200, call("GET", "/employee/search-all", hrToken, null).status());

        String hrSecret = call("POST", "/auth/2fa/setup", hrToken, null).body().get("secret").asString();
        assertEquals(200, call("POST", "/auth/2fa/enable", hrToken, obj("code", code(hrSecret, -1))).status());
        assertEquals(204, call("POST", "/auth/2fa/disable", hrToken, obj("password", "Hr-Passw0rd-Test", "code", code(hrSecret, 1))).status());
        assertFalse(call("POST", "/auth/login", null, obj("username", "hr@test.local", "password", "Hr-Passw0rd-Test")).body().get("twoFactorRequired").asBoolean());

        // set it up again, then an administrator resets it: HR signs in with the password alone and is signed out everywhere
        String hrSecret2 = call("POST", "/auth/2fa/setup", hrToken, null).body().get("secret").asString();
        assertEquals(200, call("POST", "/auth/2fa/enable", hrToken, obj("code", code(hrSecret2, -1))).status());
        assertEquals(409, call("POST", "/user/" + adminIdOf(adminToken) + "/reset-two-factor", adminToken, null).status(), "not your own");
        assertEquals(200, call("POST", "/user/" + hrId + "/reset-two-factor", adminToken, null).status());
        assertEquals(401, call("GET", "/me", hrToken, null).status(), "signed out by the reset");
        Reply after = call("POST", "/auth/login", null, obj("username", "hr@test.local", "password", "Hr-Passw0rd-Test"));
        assertEquals(200, after.status());
        assertFalse(after.body().get("twoFactorRequired").asBoolean());
        assertNotNull(after.body().get("token").asString());

        // --- sign out everywhere: every token stops working, a new login works ---
        String hrTokenA = after.body().get("token").asString();
        String hrTokenB = call("POST", "/auth/login", null, obj("username", "hr@test.local", "password", "Hr-Passw0rd-Test")).body().get("token").asString();
        assertEquals(200, call("GET", "/me", hrTokenB, null).status());
        assertEquals(204, call("POST", "/auth/sign-out-everywhere", hrTokenA, null).status());
        assertEquals(401, call("GET", "/me", hrTokenA, null).status(), "this device is signed out");
        assertEquals(401, call("GET", "/me", hrTokenB, null).status(), "and the other one too");
        assertEquals(200, call("POST", "/auth/login", null, obj("username", "hr@test.local", "password", "Hr-Passw0rd-Test")).status());
    }

    private String adminIdOf(String adminToken) throws Exception {
        return call("GET", "/me", adminToken, null).body().get("user").get("id").asString();
    }
}
