package rw.ac.auca.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * An account whose role must use two-factor sign-in (administrators) but has not set it up yet may only look at itself,
 * change its password, and set up two-factor sign-in. Everything else answers 403 with code TWO_FACTOR_SETUP_REQUIRED.
 */
public class TwoFactorSetupRequiredFilter extends OncePerRequestFilter {

    public static final String CODE = "TWO_FACTOR_SETUP_REQUIRED";

    private final ApiErrorWriter errors;

    public TwoFactorSetupRequiredFilter(ApiErrorWriter errors) {
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof AuthenticatedUser user
                && user.twoFactorSetupRequired()
                && !user.mustChangePassword()      // the password comes first; that filter answers for it
                && !isAllowed(request)) {
            errors.write(response, HttpStatus.FORBIDDEN, "Set up two-factor sign-in before you continue", CODE, request.getRequestURI());
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        return HttpMethod.OPTIONS.matches(method)
                || (HttpMethod.GET.matches(method) && path.equals("/me"))
                || (HttpMethod.POST.matches(method) && path.equals("/auth/change-password"))
                || path.startsWith("/auth/2fa");
    }
}
