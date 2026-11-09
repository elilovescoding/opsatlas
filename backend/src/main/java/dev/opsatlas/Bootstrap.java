package dev.opsatlas;

import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class Bootstrap implements ApplicationRunner {
  private final Users users;
  private final Services services;
  private final PasswordEncoder encoder;
  private final Operations operations;
  private final String email, password;
  private final boolean demo;

  Bootstrap(
      Users users,
      Services services,
      PasswordEncoder encoder,
      Operations operations,
      @Value("${ops.bootstrap-email}") String email,
      @Value("${ops.bootstrap-password}") String password,
      @Value("${ops.demo}") boolean demo) {
    this.users = users;
    this.services = services;
    this.encoder = encoder;
    this.operations = operations;
    this.email = email;
    this.password = password;
    this.demo = demo;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!email.isBlank() && users.findByEmail(AuthController.normalize(email)).isEmpty()) {
      if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
          || email.length() > 254
          || password.length() < 16
          || password.getBytes(StandardCharsets.UTF_8).length > 72)
        throw new IllegalArgumentException(
            "Bootstrap requires a valid email and password of 16–72 UTF-8 bytes.");
      UserAccount u = new UserAccount();
      u.email = AuthController.normalize(email);
      u.displayName = "Workspace administrator";
      u.passwordHash = encoder.encode(password);
      u.role = Domain.Role.ADMIN;
      users.save(u);
      operations.audit(
          "system", "ADMIN_BOOTSTRAPPED", u.id, "Administrator initialized from environment");
    }
    if (demo && services.count() == 0) {
      demoService(
          "Atlas API",
          "Request routing and application API",
          Domain.Environment.PRODUCTION,
          "Platform",
          Domain.HealthTarget.DEMO_API);
      demoService(
          "Event pipeline",
          "Asynchronous job processing; deliberately slow fixture",
          Domain.Environment.PRODUCTION,
          "Data systems",
          Domain.HealthTarget.DEMO_QUEUE);
      demoService(
          "Artifact storage",
          "Deliberately unavailable fixture for incident practice",
          Domain.Environment.STAGING,
          "Developer experience",
          Domain.HealthTarget.DEMO_STORAGE);
    }
  }

  private void demoService(
      String name,
      String description,
      Domain.Environment env,
      String owner,
      Domain.HealthTarget target) {
    RegisteredService s = new RegisteredService();
    s.name = name;
    s.description = description;
    s.environment = env;
    s.owner = owner;
    s.healthTarget = target;
    s.demo = true;
    s.publicVisible = true;
    services.save(s);
    operations.audit("system", "DEMO_SERVICE_CREATED", s.id, name + " · local fixture");
  }
}
