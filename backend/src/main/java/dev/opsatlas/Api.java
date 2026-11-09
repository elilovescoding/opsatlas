package dev.opsatlas;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Page;

public final class Api {
  private Api() {}

  public record Register(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(max = 80) String displayName,
      @NotBlank @Size(min = 12, max = 72) String password) {}

  public record Login(
      @NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {}

  public record UserView(UUID id, String email, String displayName, Domain.Role role) {
    static UserView of(UserAccount u) {
      return new UserView(u.id, u.email, u.displayName, u.role);
    }
  }

  public record RoleChange(@NotNull Domain.Role role) {}

  public record ServiceInput(
      @NotBlank @Size(max = 80) String name,
      @NotNull @Size(max = 1000) String description,
      @NotNull Domain.Environment environment,
      @NotBlank @Size(max = 80) String owner,
      @NotNull Domain.HealthTarget healthTarget,
      boolean publicVisible) {}

  public record ServiceView(
      UUID id,
      String name,
      String description,
      Domain.Environment environment,
      String owner,
      boolean archived,
      boolean publicVisible,
      boolean demo,
      Domain.HealthTarget healthTarget,
      Domain.HealthState healthState,
      Long responseMs,
      Instant checkedAt,
      Instant createdAt) {
    static ServiceView of(RegisteredService s) {
      return new ServiceView(
          s.id,
          s.name,
          s.description,
          s.environment,
          s.owner,
          s.archived,
          s.publicVisible,
          s.demo,
          s.healthTarget,
          s.healthState,
          s.responseMs,
          s.checkedAt,
          s.createdAt);
    }
  }

  public record DeployInput(
      @NotNull UUID serviceId,
      @NotBlank @Size(max = 80) String version,
      @NotNull Domain.Environment environment,
      @NotNull Domain.DeploymentStatus status,
      @NotNull @Size(max = 2000) String notes) {}

  public record DeployStatus(@NotNull Domain.DeploymentStatus status) {}

  public record DeployView(
      UUID id,
      UUID serviceId,
      String version,
      Domain.Environment environment,
      Domain.DeploymentStatus status,
      String notes,
      Instant createdAt) {
    static DeployView of(Deployment d) {
      return new DeployView(
          d.id, d.serviceId, d.version, d.environment, d.status, d.notes, d.createdAt);
    }
  }

  public record IncidentInput(
      @NotBlank @Size(max = 160) String title,
      @NotNull Domain.Severity severity,
      @NotEmpty @Size(max = 20) Set<@NotNull UUID> serviceIds,
      @NotBlank @Size(max = 80) String assignee,
      UUID deploymentId,
      @NotBlank @Size(max = 4000) String message) {}

  public record IncidentChange(
      @NotNull Domain.IncidentStatus status,
      @NotNull Domain.Severity severity,
      @NotBlank @Size(max = 80) String assignee,
      @NotBlank @Size(max = 4000) String message,
      @NotNull @Size(max = 4000) String rootCause,
      @NotNull @Size(max = 4000) String resolution) {}

  public record IncidentView(
      UUID id,
      String title,
      Domain.Severity severity,
      Domain.IncidentStatus status,
      Set<UUID> serviceIds,
      String assignee,
      UUID deploymentId,
      String rootCause,
      String resolution,
      Instant createdAt,
      Instant resolvedAt) {
    static IncidentView of(Incident i) {
      return new IncidentView(
          i.id,
          i.title,
          i.severity,
          i.status,
          Set.copyOf(i.serviceIds),
          i.assignee,
          i.deploymentId,
          i.rootCause,
          i.resolution,
          i.createdAt,
          i.resolvedAt);
    }
  }

  public record UpdateView(
      UUID id, String message, Domain.IncidentStatus status, String author, Instant createdAt) {}

  public record HealthView(
      UUID id, Domain.HealthState state, long responseMs, Integer httpStatus, Instant checkedAt) {
    static HealthView of(HealthResult h) {
      return new HealthView(h.id, h.state, h.responseMs, h.httpStatus, h.checkedAt);
    }
  }

  public record AuditView(
      UUID id, String actor, String action, UUID resourceId, String detail, Instant createdAt) {
    static AuditView of(AuditEvent e) {
      return new AuditView(e.id, e.actor, e.action, e.resourceId, e.detail, e.createdAt);
    }
  }

  public record Slice<T>(List<T> items, int page, int size, long total, int pages) {
    static <T> Slice<T> of(Page<T> p) {
      return new Slice<>(
          p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }
  }

  public record PublicService(
      UUID id,
      String name,
      Domain.Environment environment,
      boolean demo,
      Domain.HealthState state,
      Instant checkedAt) {}

  public record PublicStatus(
      Instant generatedAt, boolean demonstration, List<PublicService> services) {}
}
