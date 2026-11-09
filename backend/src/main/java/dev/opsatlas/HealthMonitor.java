package dev.opsatlas;

import io.micrometer.core.instrument.MeterRegistry;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.*;
import org.springframework.transaction.annotation.Transactional;

/** Fixed literal-IP targets prevent DNS rebinding, redirect and arbitrary URL SSRF. */
@Component
class HealthMonitor {
  private static final Logger log = LoggerFactory.getLogger(HealthMonitor.class);
  private final Services services;
  private final HealthRecorder recorder;
  private final MeterRegistry metrics;
  private final HttpClient client =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(2))
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();
  private final String host;

  HealthMonitor(
      Services services,
      HealthRecorder recorder,
      MeterRegistry metrics,
      @Value("${ops.monitor-host}") String host) {
    if (!Set.of("127.0.0.1", "172.30.0.10").contains(host))
      throw new IllegalArgumentException("Monitor host must be a fixed demonstration address.");
    this.services = services;
    this.recorder = recorder;
    this.metrics = metrics;
    this.host = host;
  }

  static URI target(Domain.HealthTarget key, String host) {
    if (!Set.of("127.0.0.1", "172.30.0.10").contains(host))
      throw new IllegalArgumentException("Unapproved monitor address");
    String path =
        switch (key) {
          case DEMO_API -> "healthy";
          case DEMO_QUEUE -> "slow";
          case DEMO_STORAGE -> "unavailable";
          case NONE -> throw new IllegalArgumentException("Monitoring disabled");
        };
    return URI.create("http://" + host + ":9090/" + path);
  }

  static Domain.HealthState classify(Integer code, long ms) {
    if (code == null || code < 200 || code >= 300) return Domain.HealthState.UNAVAILABLE;
    return ms > 500 ? Domain.HealthState.DEGRADED : Domain.HealthState.HEALTHY;
  }

  @Scheduled(fixedDelayString = "${ops.monitor-delay}", initialDelayString = "${ops.monitor-delay}")
  public void check() {
    for (RegisteredService s : services.findByArchivedFalseOrderByNameAsc()) {
      if (s.healthTarget == Domain.HealthTarget.NONE) continue;
      long start = System.nanoTime();
      Integer code = null;
      try {
        code =
            client
                .send(
                    HttpRequest.newBuilder(target(s.healthTarget, host))
                        .timeout(Duration.ofSeconds(4))
                        .GET()
                        .build(),
                    HttpResponse.BodyHandlers.discarding())
                .statusCode();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return;
      } catch (Exception e) {
        log.warn("Health probe failed service={} type={}", s.id, e.getClass().getSimpleName());
      }
      long ms = (System.nanoTime() - start) / 1_000_000;
      Domain.HealthState state = classify(code, ms);
      try {
        recorder.record(s.id, s.healthTarget, state, ms, code);
        metrics.counter("opsatlas.health.checks", "state", state.name()).increment();
        metrics
            .timer("opsatlas.health.duration", "target", s.healthTarget.name())
            .record(Duration.ofMillis(ms));
      } catch (Exception e) {
        log.error(
            "Health persistence failed service={} type={}", s.id, e.getClass().getSimpleName());
      }
    }
  }
}

@Service
class HealthRecorder {
  private final Services services;
  private final HealthResults results;

  HealthRecorder(Services services, HealthResults results) {
    this.services = services;
    this.results = results;
  }

  @Transactional
  public void record(
      UUID id, Domain.HealthTarget target, Domain.HealthState state, long ms, Integer code) {
    RegisteredService s = services.lock(id).orElseThrow(ApiErrors::missing);
    if (s.archived || s.healthTarget != target) return;
    HealthResult h = new HealthResult();
    h.serviceId = id;
    h.state = state;
    h.responseMs = ms;
    h.httpStatus = code;
    results.save(h);
    s.healthState = state;
    s.responseMs = ms;
    s.checkedAt = h.checkedAt;
  }

  @Scheduled(cron = "0 0 * * * *")
  @Transactional
  public void retain() {
    results.deleteByCheckedAtBefore(Instant.now().minus(Duration.ofDays(30)));
  }
}
