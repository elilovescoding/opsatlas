package dev.opsatlas;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.*;

@SpringBootTest(
    properties = {
      "ops.demo=false",
      "ops.bootstrap-email=",
      "ops.bootstrap-password=",
      "ops.monitor-delay=3600000"
    })
@AutoConfigureMockMvc
@Transactional
class ApiIntegrationTest {
  static PostgreSQLContainer postgres;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    String external = System.getenv("TEST_DATABASE_URL");
    if (external != null) {
      if (!external.endsWith("/opsatlas_test"))
        throw new IllegalStateException("Tests require a dedicated opsatlas_test database");
      r.add("spring.datasource.url", () -> external);
      r.add("spring.datasource.username", () -> System.getenv("TEST_DATABASE_USER"));
      r.add("spring.datasource.password", () -> System.getenv("TEST_DATABASE_PASSWORD"));
    } else {
      postgres = new PostgreSQLContainer("postgres:17.11-alpine");
      postgres.start();
      r.add("spring.datasource.url", postgres::getJdbcUrl);
      r.add("spring.datasource.username", postgres::getUsername);
      r.add("spring.datasource.password", postgres::getPassword);
    }
  }

  @AfterAll
  static void stop() {
    if (postgres != null) postgres.stop();
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired Users users;
  @Autowired Services services;
  @Autowired PasswordEncoder passwords;
  @Autowired JdbcTemplate jdbc;
  @Autowired HealthRecorder health;
  @Autowired FindByIndexNameSessionRepository<?> sessions;
  UserAccount admin;
  UserAccount viewer;

  @BeforeEach
  void setup() {
    admin = new UserAccount();
    admin.email = "admin@test.local";
    admin.displayName = "Test admin";
    admin.role = Domain.Role.ADMIN;
    admin.passwordHash = passwords.encode("test-password-12345");
    users.saveAndFlush(admin);
    viewer = new UserAccount();
    viewer.email = "viewer@test.local";
    viewer.displayName = "Test viewer";
    viewer.role = Domain.Role.VIEWER;
    viewer.passwordHash = admin.passwordHash;
    users.saveAndFlush(viewer);
  }

  String body(Object o) throws Exception {
    return json.writeValueAsString(o);
  }

  org.springframework.test.web.servlet.request.RequestPostProcessor operator() {
    return user(admin.email).roles("ADMIN");
  }

  Map<String, Object> serviceBody(String name) {
    return Map.of(
        "name",
        name,
        "description",
        "Test service",
        "environment",
        "STAGING",
        "owner",
        "Platform",
        "healthTarget",
        "NONE",
        "publicVisible",
        true);
  }

  UUID createService(String name) throws Exception {
    String response =
        mvc.perform(
                post("/api/services")
                    .with(operator())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(serviceBody(name))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return UUID.fromString(json.readTree(response).get("id").asText());
  }

  @Test
  void deniesAnonymousAndViewerWritesAndMissingCsrf() throws Exception {
    mvc.perform(get("/api/services")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/services")
                .with(user(viewer.email).roles("VIEWER"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(serviceBody("x"))))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/services")
                .with(operator())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(serviceBody("x"))))
        .andExpect(status().isForbidden());
  }

  @Test
  void registersHashedViewerAndPreventsPrivilegeInjection() throws Exception {
    mvc.perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "email",
                            "Reader@test.local",
                            "displayName",
                            "Reader",
                            "password",
                            "long-enough-password"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.role").value("VIEWER"))
        .andExpect(jsonPath("$.passwordHash").doesNotExist());
    UserAccount reader = users.findByEmail("reader@test.local").orElseThrow();
    assertThat(reader.passwordHash).isNotEqualTo("long-enough-password");
    assertThat(passwords.matches("long-enough-password", reader.passwordHash)).isTrue();
    mvc.perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"evil@test.local\",\"displayName\":\"x\",\"password\":\"long-enough-password\",\"role\":\"ADMIN\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void authenticatesAndRejectsBadCredentials() throws Exception {
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", admin.email, "password", "incorrect"))))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.detail").value("Invalid email or password."));
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", admin.email, "password", "é".repeat(37)))))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", admin.email, "password", "test-password-12345"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(admin.email));
  }

  @Test
  void rejectsStaleOperatorSessionAfterRoleRevocation() throws Exception {
    String id = saveStaleOperatorSession(sessions);
    String cookieValue = Base64.getEncoder().encodeToString(id.getBytes(StandardCharsets.UTF_8));
    mvc.perform(get("/api/services").cookie(new Cookie("SESSION", cookieValue)))
        .andExpect(status().isUnauthorized());
    assertThat(sessions.findById(id)).isNull();
  }

  private <S extends Session> String saveStaleOperatorSession(SessionRepository<S> repository) {
    S session = repository.createSession();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        UsernamePasswordAuthenticationToken.authenticated(
            viewer.email, null, AuthorityUtils.createAuthorityList("ROLE_OPERATOR")));
    session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    repository.save(session);
    return session.getId();
  }

  @Test
  void validationAndInvalidTypesAreSafe() throws Exception {
    mvc.perform(
            post("/api/services")
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/services/not-a-uuid").with(operator()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.trace").doesNotExist());
    mvc.perform(get("/api/services?size=10000").with(operator()))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/services/" + UUID.randomUUID()).with(operator()))
        .andExpect(status().isNotFound());
  }

  @Test
  void filtersAndArchivesWithoutDeletingHistory() throws Exception {
    UUID id = createService("Registry API");
    mvc.perform(get("/api/services?q=Registry&environment=STAGING&size=1").with(operator()))
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].name").value("Registry API"));
    mvc.perform(post("/api/services/" + id + "/archive").with(operator()).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/services/" + id).with(operator()))
        .andExpect(jsonPath("$.archived").value(true));
    mvc.perform(
            put("/api/services/" + id)
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(serviceBody("changed"))))
        .andExpect(status().isConflict());
  }

  @Test
  void deploymentEnvironmentAndTransitionsAreEnforced() throws Exception {
    UUID id = createService("Release API");
    Map<String, Object> d =
        new HashMap<>(
            Map.of(
                "serviceId",
                id,
                "version",
                "1.2.0",
                "environment",
                "PRODUCTION",
                "status",
                "PENDING",
                "notes",
                "Release"));
    mvc.perform(
            post("/api/deployments")
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(d)))
        .andExpect(status().isBadRequest());
    d.put("environment", "STAGING");
    String response =
        mvc.perform(
                post("/api/deployments")
                    .with(operator())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(d)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String deploy = json.readTree(response).get("id").asText();
    mvc.perform(
            patch("/api/deployments/" + deploy)
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"SUCCEEDED\"}"))
        .andExpect(status().isOk());
    mvc.perform(
            patch("/api/deployments/" + deploy)
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"PENDING\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void incidentLifecycleTimelineAndResolutionValidation() throws Exception {
    UUID id = createService("Incident API");
    String response =
        mvc.perform(
                post("/api/incidents")
                    .with(operator())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        body(
                            Map.of(
                                "title",
                                "Queue delay",
                                "severity",
                                "SEV2",
                                "serviceIds",
                                Set.of(id),
                                "assignee",
                                "Platform",
                                "message",
                                "Investigating latency"))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String incident = json.readTree(response).get("id").asText();
    mvc.perform(post("/api/services/" + id + "/archive").with(operator()).with(csrf()))
        .andExpect(status().isConflict());
    Map<String, Object> change =
        new HashMap<>(
            Map.of(
                "status",
                "RESOLVED",
                "severity",
                "SEV2",
                "assignee",
                "Platform",
                "message",
                "Recovered",
                "rootCause",
                "",
                "resolution",
                ""));
    mvc.perform(
            patch("/api/incidents/" + incident)
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(change)))
        .andExpect(status().isBadRequest());
    change.put("rootCause", "Worker saturation");
    change.put("resolution", "Scaled workers");
    mvc.perform(
            patch("/api/incidents/" + incident)
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(change)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.resolvedAt").isNotEmpty());
    mvc.perform(get("/api/incidents/" + incident + "/updates").with(operator()))
        .andExpect(jsonPath("$.total").value(2));
    mvc.perform(
            patch("/api/incidents/" + incident)
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(change)))
        .andExpect(status().isConflict());
    mvc.perform(get("/api/activity").with(operator())).andExpect(jsonPath("$.total").value(3));
  }

  @Test
  void rejectsDeploymentLinkedToUnaffectedService() throws Exception {
    UUID first = createService("First");
    UUID second = createService("Second");
    String dep =
        mvc.perform(
                post("/api/deployments")
                    .with(operator())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        body(
                            Map.of(
                                "serviceId",
                                first,
                                "version",
                                "v1",
                                "environment",
                                "STAGING",
                                "status",
                                "FAILED",
                                "notes",
                                ""))))
            .andReturn()
            .getResponse()
            .getContentAsString();
    mvc.perform(
            post("/api/incidents")
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "title",
                            "Failure",
                            "severity",
                            "SEV1",
                            "serviceIds",
                            Set.of(second),
                            "assignee",
                            "Platform",
                            "message",
                            "Investigating",
                            "deploymentId",
                            json.readTree(dep).get("id").asText()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void publicProjectionHidesPrivateFieldsAndUnpublishedServices() throws Exception {
    UUID id = createService("Public API");
    UUID hidden = createService("Hidden API");
    RegisteredService s = services.findById(hidden).orElseThrow();
    s.publicVisible = false;
    services.saveAndFlush(s);
    mvc.perform(get("/api/public/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.services.length()").value(1))
        .andExpect(jsonPath("$.services[0].owner").doesNotExist())
        .andExpect(jsonPath("$.services[0].healthTarget").doesNotExist())
        .andExpect(jsonPath("$.services[0].state").value("UNKNOWN"));
  }

  @Test
  void healthHistoryPersistsAndIgnoresChangedConfiguration() throws Exception {
    UUID id = createService("Probe API");
    RegisteredService s = services.findById(id).orElseThrow();
    s.healthTarget = Domain.HealthTarget.DEMO_API;
    services.saveAndFlush(s);
    health.record(id, Domain.HealthTarget.DEMO_API, Domain.HealthState.HEALTHY, 25, 200);
    health.record(id, Domain.HealthTarget.DEMO_QUEUE, Domain.HealthState.UNAVAILABLE, 4000, null);
    mvc.perform(get("/api/services/" + id + "/health").with(operator()))
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].responseMs").value(25));
    mvc.perform(get("/api/dashboard").with(operator()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.services.healthy").value(1))
        .andExpect(
            jsonPath("$.trends[0].day")
                .value(org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2}")));
  }

  @Test
  void databaseConstraintsPreventOrphanDeployments() {
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "insert into deployments(id,service_id,version,environment,status,notes,created_by,created_at) values (?,?,?,'STAGING','PENDING','',?,now())",
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    "v1",
                    admin.id))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
  }

  @Test
  void viewerCannotManageRolesOrReadAdminList() throws Exception {
    mvc.perform(get("/api/admin/users").with(user(viewer.email).roles("VIEWER")))
        .andExpect(status().isForbidden());
    mvc.perform(
            patch("/api/admin/users/" + admin.id + "/role")
                .with(operator())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"VIEWER\"}"))
        .andExpect(status().isBadRequest());
  }
}
