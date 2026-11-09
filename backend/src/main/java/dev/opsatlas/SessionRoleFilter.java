package dev.opsatlas;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects stale authorities even if a concurrent login escaped session deletion. */
final class SessionRoleFilter extends OncePerRequestFilter {
  private final Users users;
  private final SecurityContextLogoutHandler logout = new SecurityContextLogoutHandler();

  SessionRoleFilter(Users users) {
    this.users = users;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && !(auth instanceof AnonymousAuthenticationToken)) {
      boolean matches =
          users
              .findRoleByEmail(auth.getName())
              .map(
                  role ->
                      auth.getAuthorities().stream()
                          .anyMatch(a -> a.getAuthority().equals("ROLE_" + role.name())))
              .orElse(false);
      if (!matches) logout.logout(request, response, auth);
    }
    chain.doFilter(request, response);
  }
}
