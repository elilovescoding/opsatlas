package dev.opsatlas;

import static org.assertj.core.api.Assertions.*;

import java.time.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitTest {
  @Test
  void capsAttemptsAndExpiresTheWindow() {
    AtomicLong time = new AtomicLong(0);
    Clock clock =
        new Clock() {
          public ZoneId getZone() {
            return ZoneOffset.UTC;
          }

          public Clock withZone(ZoneId z) {
            return this;
          }

          public Instant instant() {
            return Instant.ofEpochMilli(time.get());
          }
        };
    RateLimitFilter limiter = new RateLimitFilter(clock);
    for (int i = 0; i < 20; i++) assertThat(limiter.allow("one")).isTrue();
    assertThat(limiter.allow("one")).isFalse();
    assertThat(limiter.allow("two")).isTrue();
    time.set(300_000);
    assertThat(limiter.allow("one")).isTrue();
  }

  @Test
  void boundsTheNumberOfOriginBuckets() {
    RateLimitFilter limiter = new RateLimitFilter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
    for (int i = 0; i < 4096; i++) assertThat(limiter.allow("ip-" + i)).isTrue();
    assertThat(limiter.allow("overflow")).isFalse();
  }

  @Test
  void limitsAnonymousBootstrapSeparatelyAndIncludesImplicitHead() throws Exception {
    RateLimitFilter limiter = new RateLimitFilter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
    for (int i = 0; i < 240; i++) {
      MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/csrf");
      MockHttpServletResponse response = new MockHttpServletResponse();
      limiter.doFilter(request, response, (req, res) -> {});
      assertThat(response.getStatus()).isEqualTo(200);
    }
    MockHttpServletResponse limited = new MockHttpServletResponse();
    limiter.doFilter(
        new MockHttpServletRequest("HEAD", "/api/auth/csrf"), limited, (req, res) -> {});
    assertThat(limited.getStatus()).isEqualTo(429);
    assertThat(limited.getHeader("Retry-After")).isEqualTo("300");

    MockHttpServletResponse login = new MockHttpServletResponse();
    limiter.doFilter(
        new MockHttpServletRequest("POST", "/api/auth/login"), login, (req, res) -> {});
    assertThat(login.getStatus()).isEqualTo(200);
  }
}
