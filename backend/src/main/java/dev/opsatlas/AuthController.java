package dev.opsatlas;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class AuthController {
  private final Users users;
  private final PasswordEncoder encoder;
  private final AuthenticationManager manager;
  private final HttpSessionSecurityContextRepository contexts;
  private final Operations operations;
  private final FindByIndexNameSessionRepository<?> sessions;
  private final boolean registration;

  AuthController(
      Users users,
      PasswordEncoder encoder,
      AuthenticationManager manager,
      HttpSessionSecurityContextRepository contexts,
      Operations operations,
      FindByIndexNameSessionRepository<?> sessions,
      @Value("${ops.registration-enabled}") boolean registration) {
    this.users = users;
    this.encoder = encoder;
    this.manager = manager;
    this.contexts = contexts;
    this.operations = operations;
    this.sessions = sessions;
    this.registration = registration;
  }

  @GetMapping("/auth/csrf")
  Map<String, Object> csrf(CsrfToken token) {
    return Map.of(
        "token",
        token.getToken(),
        "headerName",
        token.getHeaderName(),
        "registrationEnabled",
        registration);
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  Api.UserView register(@Valid @RequestBody Api.Register input) {
    if (!registration)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Registration is disabled.");
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72)
      throw ApiErrors.bad("Password must fit within 72 UTF-8 bytes.");
    UserAccount u = new UserAccount();
    u.email = normalize(input.email());
    u.displayName = input.displayName().trim();
    u.passwordHash = encoder.encode(input.password());
    u.role = Domain.Role.VIEWER;
    users.saveAndFlush(u);
    operations.audit(u.email, "ACCOUNT_REGISTERED", u.id, "Viewer account registered");
    return Api.UserView.of(u);
  }

  @PostMapping("/auth/login")
  Api.UserView login(
      @Valid @RequestBody Api.Login input,
      HttpServletRequest request,
      HttpServletResponse response) {
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72)
      throw new BadCredentialsException("Invalid credentials");
    Authentication auth =
        manager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(
                normalize(input.email()), input.password()));
    request.getSession(true);
    request.changeSessionId();
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(auth);
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, request, response);
    operations.audit(auth.getName(), "LOGIN", null, "Session created");
    return Api.UserView.of(users.findByEmail(auth.getName()).orElseThrow(ApiErrors::missing));
  }

  @GetMapping("/auth/me")
  Api.UserView me(Authentication auth) {
    return Api.UserView.of(users.findByEmail(auth.getName()).orElseThrow(ApiErrors::missing));
  }

  @GetMapping("/admin/users")
  Api.Slice<Api.UserView> users(@RequestParam(defaultValue = "0") int page) {
    return Api.Slice.of(
        users
            .findAll(
                PageRequest.of(
                    Math.max(0, page),
                    25,
                    org.springframework.data.domain.Sort.by("createdAt").descending()))
            .map(Api.UserView::of));
  }

  @PatchMapping("/admin/users/{id}/role")
  @Transactional
  Api.UserView role(
      @PathVariable UUID id, @Valid @RequestBody Api.RoleChange input, Authentication auth) {
    UserAccount u = users.lock(id).orElseThrow(ApiErrors::missing);
    if (u.email.equals(auth.getName())) throw ApiErrors.bad("You cannot change your own role.");
    // Administrator accounts are immutable through this API, preserving an access recovery path.
    if (u.role == Domain.Role.ADMIN)
      throw ApiErrors.bad("Bootstrap administrators cannot be changed here.");
    if (input.role() == Domain.Role.ADMIN)
      throw ApiErrors.bad("Create administrators through the operator bootstrap procedure.");
    u.role = input.role();
    operations.audit(auth.getName(), "ROLE_CHANGED", u.id, "Role changed to " + u.role);
    sessions.findByPrincipalName(u.email).keySet().forEach(sessions::deleteById);
    return Api.UserView.of(u);
  }

  static String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
