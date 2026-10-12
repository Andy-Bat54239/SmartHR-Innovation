package rw.ac.auca.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Instant;

/**
 * Time-based one-time passwords (RFC 6238), the 6-digit codes of Google Authenticator, Authy, Microsoft Authenticator
 * and the like: HMAC-SHA1, 30 second steps. A code is also accepted one step before or after the current one, so a
 * slightly wrong phone clock still works.
 */
public final class Totp {

    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int STEP_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    /** A new random 160-bit secret, in the Base32 form authenticator apps expect. */
    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    /** What the QR code holds: the app reads the account name, the issuer and the secret from it. */
    public static String otpauthUri(String issuer, String account, String secret) {
        return "otpauth://totp/" + encode(issuer) + ":" + encode(account)
                + "?secret=" + secret + "&issuer=" + encode(issuer) + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    /**
     * Checks a code. Returns the time step it belongs to when it is right, or -1 when it is not. The caller keeps the
     * last step it accepted and rejects any step that is not newer, so a code cannot be used twice.
     */
    public static long verify(String secret, String code, long lastAcceptedStep) {
        if (code == null || !code.matches("\\d{" + DIGITS + "}")) return -1;
        long current = Instant.now().getEpochSecond() / STEP_SECONDS;
        for (long step = current - 1; step <= current + 1; step++) {
            if (step > lastAcceptedStep && constantTimeEquals(code, codeFor(secret, step))) {
                return step;
            }
        }
        return -1;
    }

    /** The code for a given time step (public so a test can compute the expected value). */
    public static String codeFor(String secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(decodeBase32(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
            return String.format("%0" + DIGITS + "d", binary % (int) Math.pow(10, DIGITS));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA1 is not available", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String encode(String text) {
        return URLEncoder.encode(text, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        return out.toString();
    }

    private static byte[] decodeBase32(String text) {
        String clean = text.replace("=", "").replace(" ", "").toUpperCase();
        ByteBuffer out = ByteBuffer.allocate(clean.length() * 5 / 8);
        int buffer = 0;
        int bits = 0;
        for (char c : clean.toCharArray()) {
            int value = BASE32.indexOf(c);
            if (value < 0) throw new IllegalArgumentException("Not a Base32 secret");
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) ((buffer >> (bits - 8)) & 0xff));
                bits -= 8;
            }
        }
        return java.util.Arrays.copyOf(out.array(), out.position());
    }
}
