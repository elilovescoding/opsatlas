package dev.opsatlas;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

interface Users extends JpaRepository<UserAccount, UUID> {
  Optional<UserAccount> findByEmail(String email);

  @Query("select u.role from UserAccount u where u.email=:email")
  Optional<Domain.Role> findRoleByEmail(@Param("email") String email);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select u from UserAccount u where u.id=:id")
  Optional<UserAccount> lock(@Param("id") UUID id);
}

interface Services extends JpaRepository<RegisteredService, UUID> {
  @Query(
      "select s from RegisteredService s where s.archived=false and (:env is null or s.environment=:env) and lower(s.name) like lower(concat('%',:q,'%'))")
  Page<RegisteredService> search(
      @Param("env") Domain.Environment env, @Param("q") String q, Pageable pageable);

  List<RegisteredService> findByArchivedFalseOrderByNameAsc();

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from RegisteredService s where s.id=:id")
  Optional<RegisteredService> lock(@Param("id") UUID id);
}

interface Deployments extends JpaRepository<Deployment, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select d from Deployment d where d.id=:id")
  Optional<Deployment> lock(@Param("id") UUID id);

  @Query("select d from Deployment d where (:service is null or d.serviceId=:service)")
  Page<Deployment> search(@Param("service") UUID service, Pageable pageable);
}

interface Incidents extends JpaRepository<Incident, UUID> {
  @Query(
      "select i from Incident i where (:status is null or i.status=:status) and (:service is null or :service member of i.serviceIds)")
  Page<Incident> search(
      @Param("status") Domain.IncidentStatus status,
      @Param("service") UUID service,
      Pageable pageable);

  @Query(
      "select count(i)>0 from Incident i where i.status<>:resolved and :service member of i.serviceIds")
  boolean hasOpenForService(
      @Param("service") UUID service, @Param("resolved") Domain.IncidentStatus resolved);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select i from Incident i where i.id=:id")
  Optional<Incident> lock(@Param("id") UUID id);
}

interface Updates extends JpaRepository<IncidentUpdate, UUID> {
  Page<IncidentUpdate> findByIncidentId(UUID id, Pageable pageable);
}

interface HealthResults extends JpaRepository<HealthResult, UUID> {
  Page<HealthResult> findByServiceId(UUID id, Pageable pageable);

  long deleteByCheckedAtBefore(Instant cutoff);
}

interface AuditEvents extends JpaRepository<AuditEvent, UUID> {}
