package dev.opsatlas;

import java.time.Clock;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;

@Configuration
@EnableMethodSecurity
class SecurityConfig {
  @Bean
  PasswordEncoder passwords() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  UserDetailsService details(Users users) {
    return email ->
        users
            .findByEmail(email)
            .map(
                u ->
                    User.withUsername(u.email)
                        .password(u.passwordHash)
                        .roles(u.role.name())
                        .build())
            .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
  }

  @Bean
  AuthenticationManager authenticationManager(UserDetailsService details, PasswordEncoder encoder) {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider(details);
    provider.setPasswordEncoder(encoder);
    return new ProviderManager(provider);
  }

  @Bean
  HttpSessionSecurityContextRepository contextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  SecurityFilterChain security(
      HttpSecurity http, HttpSessionSecurityContextRepository repository, Users users)
      throws Exception {
    http.csrf(
            c ->
                c.csrfTokenRepository(new HttpSessionCsrfTokenRepository())
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .securityContext(c -> c.securityContextRepository(repository))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/auth/csrf",
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/public/status")
                    .permitAll()
                    .requestMatchers(
                        "/actuator/health/**", "/actuator/prometheus", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/api/admin/**")
                    .hasRole("ADMIN")
                    .requestMatchers(HttpMethod.GET, "/api/**", "/v3/api-docs/**", "/swagger-ui/**")
                    .authenticated()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (req, res, ex) -> {
                          res.setStatus(401);
                          res.setContentType("application/problem+json");
                          res.getWriter().write("{\"status\":401,\"detail\":\"Please sign in.\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, ex) -> {
                          res.setStatus(403);
                          res.setContentType("application/problem+json");
                          res.getWriter()
                              .write(
                                  "{\"status\":403,\"detail\":\"Access denied or CSRF token expired. Refresh and retry.\"}");
                        }))
        .logout(
            l ->
                l.logoutUrl("/api/auth/logout")
                    .invalidateHttpSession(true)
                    .clearAuthentication(true)
                    .deleteCookies("SESSION")
                    .logoutSuccessHandler((req, res, a) -> res.setStatus(204)))
        .headers(
            h ->
                h.contentTypeOptions(c -> {})
                    .frameOptions(f -> f.deny())
                    .referrerPolicy(
                        r ->
                            r.policy(
                                org.springframework.security.web.header.writers
                                    .ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN)))
        .addFilterBefore(new RateLimitFilter(Clock.systemUTC()), CsrfFilter.class)
        .addFilterBefore(new SessionRoleFilter(users), AuthorizationFilter.class);
    return http.build();
  }
}
