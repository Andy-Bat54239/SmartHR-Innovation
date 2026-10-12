package rw.ac.auca.security;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TotpTest {

    // RFC 6238 appendix B: the ASCII secret "12345678901234567890" in Base32, SHA-1, 6 digits (the last 6 of the 8-digit values)
    private static final String RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    @Test
    void matchesTheRfc6238TestVectors() {
        assertEquals("287082", Totp.codeFor(RFC_SECRET, 59L / 30));
        assertEquals("081804", Totp.codeFor(RFC_SECRET, 1111111109L / 30));
        assertEquals("050471", Totp.codeFor(RFC_SECRET, 1111111111L / 30));
        assertEquals("005924", Totp.codeFor(RFC_SECRET, 1234567890L / 30));
    }

    @Test
    void acceptsTheCurrentCodeOnceAndNotAgain() {
        String secret = Totp.newSecret();
        long step = Instant.now().getEpochSecond() / 30;
        String code = Totp.codeFor(secret, step);

        long accepted = Totp.verify(secret, code, -1);
        assertEquals(step, accepted);
        // the same code again is a replay
        assertEquals(-1, Totp.verify(secret, code, accepted));
    }

    @Test
    void rejectsWrongOrMalformedCodes() {
        String secret = Totp.newSecret();
        String right = Totp.codeFor(secret, Instant.now().getEpochSecond() / 30);
        String wrong = right.equals("000000") ? "000001" : "000000";
        assertEquals(-1, Totp.verify(secret, wrong, -1));
        assertEquals(-1, Totp.verify(secret, "12345", -1));
        assertEquals(-1, Totp.verify(secret, "abcdef", -1));
        assertEquals(-1, Totp.verify(secret, null, -1));
    }

    @Test
    void buildsAnOtpauthLinkAuthenticatorAppsRead() {
        String uri = Totp.otpauthUri("SmartHR", "a.b@example.com", "ABC234");
        assertTrue(uri.startsWith("otpauth://totp/SmartHR:a.b%40example.com?secret=ABC234"));
        assertTrue(uri.contains("issuer=SmartHR"));
    }

    @Test
    void secretsAreBase32AndDifferEveryTime() {
        String a = Totp.newSecret();
        assertTrue(a.matches("[A-Z2-7]{32}"));
        assertTrue(!a.equals(Totp.newSecret()));
    }
}
