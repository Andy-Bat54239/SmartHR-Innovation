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
 * An account whose password was just set by an administrator may do nothing except look at itself and
 * choose a new password. Everything else answers 403 with code PASSWORD_CHANGE_REQUIRED.
 */
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    public static final String CODE = "PASSWORD_CHANGE_REQUIRED";

    private final ApiErrorWriter errors;

    public PasswordChangeRequiredFilter(ApiErrorWriter errors) {
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof AuthenticatedUser user
                && user.mustChangePassword()
                && !isAllowed(request)) {
            errors.write(response, HttpStatus.FORBIDDEN, "Choose a new password before you continue", CODE, request.getRequestURI());
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        return HttpMethod.OPTIONS.matches(method)
                || (HttpMethod.POST.matches(method) && path.equals("/auth/change-password"))
                || (HttpMethod.GET.matches(method) && path.equals("/me"));
    }
}
