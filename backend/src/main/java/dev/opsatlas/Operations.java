package dev.opsatlas;

import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
class Operations {
  private final Services services;
  private final Deployments deployments;
  private final Incidents incidents;
  private final Updates updates;
  private final Users users;
  private final AuditEvents audits;

  Operations(
      Services services,
      Deployments deployments,
      Incidents incidents,
      Updates updates,
      Users users,
      AuditEvents audits) {
    this.services = services;
    this.deployments = deployments;
    this.incidents = incidents;
    this.updates = updates;
    this.users = users;
    this.audits = audits;
  }

  void audit(String actor, String action, UUID resource, String detail) {
    AuditEvent e = new AuditEvent();
    e.actor = actor;
    e.action = action;
    e.resourceId = resource;
    e.detail = detail;
    audits.save(e);
  }

  UUID userId(String email) {
    return users.findByEmail(email).orElseThrow(ApiErrors::missing).id;
  }

  RegisteredService active(UUID id) {
    RegisteredService s = services.lock(id).orElseThrow(ApiErrors::missing);
    if (s.archived) throw ApiErrors.conflict("Archived services are read-only.");
    return s;
  }

  Api.ServiceView saveService(UUID id, Api.ServiceInput input, String actor) {
    RegisteredService s = id == null ? new RegisteredService() : active(id);
    s.name = input.name().trim();
    s.description = input.description().trim();
    s.environment = input.environment();
    s.owner = input.owner().trim();
    s.publicVisible = input.publicVisible();
    if (s.healthTarget != input.healthTarget()) {
      s.healthState = Domain.HealthState.UNKNOWN;
      s.responseMs = null;
      s.checkedAt = null;
    }
    s.healthTarget = input.healthTarget();
    s.demo = s.healthTarget != Domain.HealthTarget.NONE;
    services.saveAndFlush(s);
    audit(actor, id == null ? "SERVICE_REGISTERED" : "SERVICE_UPDATED", s.id, s.name);
    return Api.ServiceView.of(s);
  }

  void archive(UUID id, String actor) {
    RegisteredService s = active(id);
    boolean hasOpen = incidents.hasOpenForService(id, Domain.IncidentStatus.RESOLVED);
    if (hasOpen)
      throw ApiErrors.conflict("Resolve active incidents before archiving this service.");
    s.archived = true;
    audit(actor, "SERVICE_ARCHIVED", id, s.name);
  }

  Api.DeployView deploy(Api.DeployInput input, String actor) {
    RegisteredService s = active(input.serviceId());
    if (s.environment != input.environment())
      throw ApiErrors.bad("Deployment environment must match the registered service.");
    Deployment d = new Deployment();
    d.serviceId = s.id;
    d.version = input.version().trim();
    d.environment = input.environment();
    d.status = input.status();
    d.notes = input.notes().trim();
    d.createdBy = userId(actor);
    deployments.save(d);
    audit(actor, "DEPLOYMENT_RECORDED", d.id, s.name + " · " + d.version);
    return Api.DeployView.of(d);
  }

  Api.DeployView deploymentStatus(UUID id, Api.DeployStatus input, String actor) {
    Deployment d = deployments.lock(id).orElseThrow(ApiErrors::missing);
    active(d.serviceId);
    if (d.status == input.status()) throw ApiErrors.conflict("Deployment already has this status.");
    boolean allowed =
        d.status == Domain.DeploymentStatus.PENDING
                && Set.of(Domain.DeploymentStatus.SUCCEEDED, Domain.DeploymentStatus.FAILED)
                    .contains(input.status())
            || d.status == Domain.DeploymentStatus.SUCCEEDED
                && input.status() == Domain.DeploymentStatus.ROLLED_BACK;
    if (!allowed) throw ApiErrors.conflict("Invalid deployment transition.");
    d.status = input.status();
    audit(actor, "DEPLOYMENT_UPDATED", id, d.version + " · " + d.status);
    return Api.DeployView.of(d);
  }

  Api.IncidentView open(Api.IncidentInput input, String actor) {
    input.serviceIds().stream().sorted().forEach(this::active);
    if (input.deploymentId() != null) {
      Deployment d = deployments.findById(input.deploymentId()).orElseThrow(ApiErrors::missing);
      if (!input.serviceIds().contains(d.serviceId))
        throw ApiErrors.bad("Linked deployment must belong to an affected service.");
    }
    Incident i = new Incident();
    i.title = input.title().trim();
    i.severity = input.severity();
    i.assignee = input.assignee().trim();
    i.serviceIds.addAll(input.serviceIds());
    i.deploymentId = input.deploymentId();
    i.createdBy = userId(actor);
    incidents.saveAndFlush(i);
    append(i, input.message().trim(), i.createdBy);
    audit(actor, "INCIDENT_OPENED", i.id, i.title);
    return Api.IncidentView.of(i);
  }

  Api.IncidentView updateIncident(UUID id, Api.IncidentChange input, String actor) {
    Incident i = incidents.lock(id).orElseThrow(ApiErrors::missing);
    if (i.status == Domain.IncidentStatus.RESOLVED)
      throw ApiErrors.conflict(
          "Resolved incidents are immutable. Open a follow-up incident if needed.");
    if (input.status() == Domain.IncidentStatus.RESOLVED
        && (input.rootCause().isBlank() || input.resolution().isBlank()))
      throw ApiErrors.bad("Root cause and resolution are required to resolve an incident.");
    if (input.status() != i.status && input.status().ordinal() < i.status.ordinal())
      throw ApiErrors.conflict("Incident status cannot move backwards.");
    i.status = input.status();
    i.severity = input.severity();
    i.assignee = input.assignee().trim();
    i.rootCause = input.rootCause().trim();
    i.resolution = input.resolution().trim();
    if (i.status == Domain.IncidentStatus.RESOLVED) i.resolvedAt = Instant.now();
    append(i, input.message().trim(), userId(actor));
    audit(
        actor,
        i.status == Domain.IncidentStatus.RESOLVED ? "INCIDENT_RESOLVED" : "INCIDENT_UPDATED",
        i.id,
        i.title);
    return Api.IncidentView.of(i);
  }

  private void append(Incident i, String message, UUID author) {
    IncidentUpdate u = new IncidentUpdate();
    u.incidentId = i.id;
    u.message = message;
    u.authorId = author;
    u.status = i.status;
    updates.save(u);
  }

  @Transactional(readOnly = true)
  Api.IncidentView incident(UUID id) {
    return Api.IncidentView.of(incidents.findById(id).orElseThrow(ApiErrors::missing));
  }

  @Transactional(readOnly = true)
  Api.Slice<Api.UpdateView> timeline(UUID id, Pageable pageable) {
    if (!incidents.existsById(id)) throw ApiErrors.missing();
    return Api.Slice.of(
        updates
            .findByIncidentId(id, pageable)
            .map(
                u ->
                    new Api.UpdateView(
                        u.id,
                        u.message,
                        u.status,
                        users.findById(u.authorId).map(a -> a.displayName).orElse("Former member"),
                        u.createdAt)));
  }

  @Transactional(readOnly = true)
  Api.Slice<Api.IncidentView> listIncidents(
      Domain.IncidentStatus status, UUID service, Pageable pageable) {
    return Api.Slice.of(incidents.search(status, service, pageable).map(Api.IncidentView::of));
  }
}
