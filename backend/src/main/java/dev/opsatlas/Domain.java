package dev.opsatlas;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

/** Entities stay behind explicit API projections; password hashes never leave this package. */
public final class Domain {
  private Domain() {}

  public enum Role {
    VIEWER,
    OPERATOR,
    ADMIN
  }

  public enum Environment {
    DEVELOPMENT,
    STAGING,
    PRODUCTION
  }

  public enum HealthState {
    UNKNOWN,
    HEALTHY,
    DEGRADED,
    UNAVAILABLE
  }

  public enum HealthTarget {
    NONE,
    DEMO_API,
    DEMO_QUEUE,
    DEMO_STORAGE
  }

  public enum Severity {
    SEV1,
    SEV2,
    SEV3,
    SEV4
  }

  public enum IncidentStatus {
    INVESTIGATING,
    IDENTIFIED,
    MONITORING,
    RESOLVED
  }

  public enum DeploymentStatus {
    PENDING,
    SUCCEEDED,
    FAILED,
    ROLLED_BACK
  }
}

@MappedSuperclass
abstract class BaseEntity {
  @Id UUID id = UUID.randomUUID();

  @Column(nullable = false)
  Instant createdAt = Instant.now();
}

@Entity
@Table(name = "users")
class UserAccount extends BaseEntity {
  @Column(nullable = false, unique = true, length = 254)
  String email;

  @Column(nullable = false, length = 80)
  String displayName;

  @Column(nullable = false, length = 100)
  String passwordHash;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.Role role;
}

@Entity
@Table(name = "services")
class RegisteredService extends BaseEntity {
  @Column(nullable = false, length = 80)
  String name;

  @Column(nullable = false, length = 1000)
  String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.Environment environment;

  @Column(nullable = false, length = 80)
  String owner;

  boolean archived;
  boolean publicVisible;
  boolean demo;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 24)
  Domain.HealthTarget healthTarget;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.HealthState healthState = Domain.HealthState.UNKNOWN;

  Long responseMs;
  Instant checkedAt;
  @Version long version;
}

@Entity
@Table(name = "deployments")
class Deployment extends BaseEntity {
  @Column(nullable = false)
  UUID serviceId;

  @Column(nullable = false, length = 80)
  String version;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.Environment environment;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.DeploymentStatus status;

  @Column(nullable = false, length = 2000)
  String notes;

  @Column(nullable = false)
  UUID createdBy;
}

@Entity
@Table(name = "incidents")
class Incident extends BaseEntity {
  @Column(nullable = false, length = 160)
  String title;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 8)
  Domain.Severity severity;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.IncidentStatus status = Domain.IncidentStatus.INVESTIGATING;

  @Column(nullable = false, length = 80)
  String assignee;

  UUID deploymentId;

  @Column(nullable = false, length = 4000)
  String rootCause = "";

  @Column(nullable = false, length = 4000)
  String resolution = "";

  @Column(nullable = false)
  UUID createdBy;

  Instant resolvedAt;

  @ElementCollection
  @CollectionTable(name = "incident_services", joinColumns = @JoinColumn(name = "incident_id"))
  @Column(name = "service_id")
  Set<UUID> serviceIds = new HashSet<>();

  @Version long version;
}

@Entity
@Table(name = "incident_updates")
class IncidentUpdate extends BaseEntity {
  @Column(nullable = false)
  UUID incidentId;

  @Column(nullable = false, length = 4000)
  String message;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.IncidentStatus status;

  @Column(nullable = false)
  UUID authorId;
}

@Entity
@Table(name = "health_results")
class HealthResult {
  @Id UUID id = UUID.randomUUID();

  @Column(nullable = false)
  UUID serviceId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  Domain.HealthState state;

  long responseMs;
  Integer httpStatus;

  @Column(nullable = false)
  Instant checkedAt = Instant.now();
}

@Entity
@Table(name = "audit_events")
class AuditEvent extends BaseEntity {
  @Column(nullable = false, length = 254)
  String actor;

  @Column(nullable = false, length = 40)
  String action;

  UUID resourceId;

  @Column(nullable = false, length = 300)
  String detail;
}
