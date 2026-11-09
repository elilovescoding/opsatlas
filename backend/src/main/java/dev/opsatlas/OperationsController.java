package dev.opsatlas;

import jakarta.validation.Valid;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
class OperationsController {
  private final Operations operations;
  private final Services services;
  private final Deployments deployments;
  private final HealthResults health;
  private final AuditEvents audits;

  OperationsController(
      Operations operations,
      Services services,
      Deployments deployments,
      HealthResults health,
      AuditEvents audits) {
    this.operations = operations;
    this.services = services;
    this.deployments = deployments;
    this.health = health;
    this.audits = audits;
  }

  static Pageable page(int page, int size, String sort) {
    if (page < 0 || page > 10000 || size < 1 || size > 100)
      throw ApiErrors.bad("Page must be 0–10000 and size 1–100.");
    return PageRequest.of(page, size, Sort.by(sort).descending().and(Sort.by("id")));
  }

  @GetMapping("/services")
  Api.Slice<Api.ServiceView> services(
      @RequestParam(required = false) Domain.Environment environment,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    if (q.length() > 80) throw ApiErrors.bad("Search is limited to 80 characters.");
    return Api.Slice.of(
        services.search(environment, q, page(page, size, "createdAt")).map(Api.ServiceView::of));
  }

  @GetMapping("/services/{id}")
  Api.ServiceView service(@PathVariable UUID id) {
    return Api.ServiceView.of(services.findById(id).orElseThrow(ApiErrors::missing));
  }

  @PostMapping("/services")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  Api.ServiceView create(@Valid @RequestBody Api.ServiceInput input, Authentication a) {
    return operations.saveService(null, input, a.getName());
  }

  @PutMapping("/services/{id}")
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  Api.ServiceView edit(
      @PathVariable UUID id, @Valid @RequestBody Api.ServiceInput input, Authentication a) {
    return operations.saveService(id, input, a.getName());
  }

  @PostMapping("/services/{id}/archive")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  void archive(@PathVariable UUID id, Authentication a) {
    operations.archive(id, a.getName());
  }

  @GetMapping("/services/{id}/health")
  Api.Slice<Api.HealthView> health(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "60") int size) {
    if (!services.existsById(id)) throw ApiErrors.missing();
    return Api.Slice.of(
        health.findByServiceId(id, page(page, size, "checkedAt")).map(Api.HealthView::of));
  }

  @GetMapping("/deployments")
  Api.Slice<Api.DeployView> deployments(
      @RequestParam(required = false) UUID serviceId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return Api.Slice.of(
        deployments.search(serviceId, page(page, size, "createdAt")).map(Api.DeployView::of));
  }

  @PostMapping("/deployments")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  Api.DeployView deploy(@Valid @RequestBody Api.DeployInput input, Authentication a) {
    return operations.deploy(input, a.getName());
  }

  @PatchMapping("/deployments/{id}")
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  Api.DeployView deployStatus(
      @PathVariable UUID id, @Valid @RequestBody Api.DeployStatus input, Authentication a) {
    return operations.deploymentStatus(id, input, a.getName());
  }

  @GetMapping("/incidents")
  Api.Slice<Api.IncidentView> incidents(
      @RequestParam(required = false) Domain.IncidentStatus status,
      @RequestParam(required = false) UUID serviceId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return operations.listIncidents(status, serviceId, page(page, size, "createdAt"));
  }

  @GetMapping("/incidents/{id}")
  Api.IncidentView incident(@PathVariable UUID id) {
    return operations.incident(id);
  }

  @GetMapping("/incidents/{id}/updates")
  Api.Slice<Api.UpdateView> timeline(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size) {
    return operations.timeline(id, page(page, size, "createdAt"));
  }

  @PostMapping("/incidents")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  Api.IncidentView open(@Valid @RequestBody Api.IncidentInput input, Authentication a) {
    return operations.open(input, a.getName());
  }

  @PatchMapping("/incidents/{id}")
  @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
  Api.IncidentView update(
      @PathVariable UUID id, @Valid @RequestBody Api.IncidentChange input, Authentication a) {
    return operations.updateIncident(id, input, a.getName());
  }

  @GetMapping("/activity")
  Api.Slice<Api.AuditView> activity(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    return Api.Slice.of(audits.findAll(page(page, size, "createdAt")).map(Api.AuditView::of));
  }
}
