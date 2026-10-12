package rw.ac.auca.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.repository.AppUserRepository;

import java.util.List;
import java.util.UUID;

/**
 * Turns a verified token into the signed-in user. The signature proves the token is ours; this step checks
 * that the account still exists, is still switched on, and that the password has not changed since the
 * token was issued. The role comes from the database, never from the token.
 */
@Component
public class JwtUserConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Autowired
    private AppUserRepository users;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        UUID id;
        try {
            id = UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw invalid();
        }
        AppUser user = users.findById(id).orElseThrow(this::invalid);
        Number version = jwt.getClaim(JwtService.VERSION_CLAIM);
        if (!user.isEnabled() || version == null || version.intValue() != user.getTokenVersion()) {
            throw invalid();
        }
        AuthenticatedUser principal = new AuthenticatedUser(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getEmployee() == null ? null : user.getEmployee().getId(),
                user.isMustChangePassword(),
                user.getRole().requiresTwoFactor() && !user.isTwoFactorEnabled());
        return new UsernamePasswordAuthenticationToken(principal, jwt, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }

    private AuthenticationException invalid() {
        return new BadCredentialsException("Your session has expired or is no longer valid. Sign in again.");
    }
}
