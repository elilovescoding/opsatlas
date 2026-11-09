package dev.opsatlas;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.*;
import java.util.*;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounded per-origin fixed-window limiter. Never trusts caller-supplied forwarding headers. */
final class RateLimitFilter extends OncePerRequestFilter {
  private final Map<String, Window> windows = new HashMap<>();
  private final Clock clock;

  RateLimitFilter(Clock clock) {
    this.clock = clock;
  }

  private record Window(long start, int count) {}

  boolean allow(String address) {
    return allow(address, 20);
  }

  private synchronized boolean allow(String key, int limit) {
    long now = clock.millis();
    windows.entrySet().removeIf(e -> now - e.getValue().start >= 300_000);
    Window w = windows.get(key);
    if (w == null && windows.size() >= 4096) return false;
    if (w != null && w.count >= limit) return false;
    windows.put(key, new Window(w == null ? now : w.start, w == null ? 1 : w.count + 1));
    return true;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String path = request.getRequestURI().substring(request.getContextPath().length());
    boolean authAttempt =
        "POST".equals(request.getMethod())
            && Set.of("/api/auth/login", "/api/auth/register").contains(path);
    boolean sessionBootstrap =
        Set.of("GET", "HEAD").contains(request.getMethod())
            && path.equals("/api/auth/csrf")
            && request.getSession(false) == null;
    if ((authAttempt && !allow(request.getRemoteAddr()))
        || (sessionBootstrap && !allow("bootstrap:" + request.getRemoteAddr(), 240))) {
      response.setStatus(429);
      response.setHeader("Retry-After", "300");
      response.setContentType("application/problem+json");
      response
          .getWriter()
          .write("{\"status\":429,\"detail\":\"Too many attempts. Try again in five minutes.\"}");
      return;
    }
    chain.doFilter(request, response);
  }
}
