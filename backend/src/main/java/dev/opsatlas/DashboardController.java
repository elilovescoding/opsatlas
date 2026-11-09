package dev.opsatlas;

import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
class DashboardController {
  private final JdbcTemplate jdbc;
  private final Services services;
  private final boolean demo;

  DashboardController(JdbcTemplate jdbc, Services services, @Value("${ops.demo}") boolean demo) {
    this.jdbc = jdbc;
    this.services = services;
    this.demo = demo;
  }

  @GetMapping("/dashboard")
  Map<String, Object> dashboard() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("generatedAt", Instant.now());
    result.put("demonstration", demo);
    result.put(
        "services",
        jdbc.queryForMap(
            "select count(*) as total, count(*) filter(where health_state='HEALTHY') as healthy, count(*) filter(where health_state in ('DEGRADED','UNAVAILABLE')) as unhealthy, count(*) filter(where health_state='UNKNOWN') as unknown, count(*) filter(where checked_at < now()-interval '3 minutes') as stale from services where not archived"));
    result.put(
        "incidents",
        jdbc.queryForMap(
            "select count(*) filter(where status<>'RESOLVED') as active, count(*) filter(where status='RESOLVED') as resolved, round(avg(extract(epoch from resolved_at-created_at)/60)::numeric,1) as mttr_minutes from incidents"));
    result.put(
        "latency",
        jdbc.queryForList(
            "select date_trunc('hour',checked_at) as time, round(avg(response_ms)) as ms, count(*) as samples from health_results where checked_at>now()-interval '24 hours' group by 1 order by 1"));
    result.put(
        "trends",
        jdbc.query(
            "select d::date as day, count(i.id) as opened from generate_series(current_date-6,current_date,interval '1 day') d left join incidents i on i.created_at>=d and i.created_at<d+interval '1 day' group by d order by d",
            (rs, row) ->
                Map.of(
                    "day",
                    rs.getObject("day", java.time.LocalDate.class).toString(),
                    "opened",
                    rs.getLong("opened"))));
    result.put(
        "runtime",
        jdbc.queryForMap(
            "select count(*) as health_samples_24h, count(*) filter(where state='UNAVAILABLE') as failed_samples_24h from health_results where checked_at>now()-interval '24 hours'"));
    return result;
  }

  @GetMapping("/public/status")
  Api.PublicStatus status() {
    return new Api.PublicStatus(
        Instant.now(),
        demo,
        services.findByArchivedFalseOrderByNameAsc().stream()
            .filter(s -> s.publicVisible)
            .map(
                s ->
                    new Api.PublicService(
                        s.id,
                        s.name,
                        s.environment,
                        s.demo,
                        s.healthTarget == Domain.HealthTarget.NONE
                                || s.checkedAt == null
                                || s.checkedAt.isBefore(Instant.now().minusSeconds(180))
                            ? Domain.HealthState.UNKNOWN
                            : s.healthState,
                        s.checkedAt))
            .toList());
  }
}
