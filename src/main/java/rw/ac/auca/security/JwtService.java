package rw.ac.auca.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import java.time.Duration;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import rw.ac.auca.user.domain.AppUser;

import java.time.Instant;

/**
 * Creates the signed login token. It carries only who the account is and its token version: the role and
 * the on/off switch are looked up in the database on every request, so changing them takes effect at once.
 */
@Service
public class JwtService {

    public static final String ISSUER = "smarthr";
    public static final String VERSION_CLAIM = "ver";
    /** Marks the short-lived token handed out between the password and the two-factor code. It can do nothing else. */
    static final String TYPE_CLAIM = "typ";
    static final String CHALLENGE_TYPE = "2fa";
    static final String CHALLENGE_VERSION_CLAIM = "cver";
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);

    /** Who a two-factor challenge was issued to, and the token version it was issued at. */
    public record Challenge(UUID userId, int version) {
    }

    public record IssuedToken(String value, Instant expiresAt) {
    }

    @Autowired
    private JwtEncoder encoder;

    @Autowired
    private SecurityProperties properties;

    @Autowired
    private JwtDecoder decoder;

    /**
     * Proof that the password was right, valid for 5 minutes and only for the second step of signing in. It has no
     * "ver" claim, so the API refuses it as a login token; and a login token has no "typ" claim, so it is refused here.
     */
    public String issueChallenge(AppUser user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(CHALLENGE_TTL))
                .claim(TYPE_CLAIM, CHALLENGE_TYPE)
                .claim(CHALLENGE_VERSION_CLAIM, user.getTokenVersion())
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    /** Reads a challenge token; anything else (expired, forged, a normal login token) is "start again". */
    public Challenge verifyChallenge(String token) {
        try {
            Jwt jwt = decoder.decode(token);
            Number version = jwt.getClaim(CHALLENGE_VERSION_CLAIM);
            if (!CHALLENGE_TYPE.equals(jwt.getClaimAsString(TYPE_CLAIM)) || version == null) {
                throw new BadCredentialsException("invalid challenge");
            }
            return new Challenge(UUID.fromString(jwt.getSubject()), version.intValue());
        } catch (JwtException | IllegalArgumentException | NullPointerException e) {
            throw new BadCredentialsException("Your sign-in took too long or is no longer valid. Sign in again.");
        }
    }

    public IssuedToken issueFor(AppUser user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.tokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim(VERSION_CLAIM, user.getTokenVersion())
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }
}
