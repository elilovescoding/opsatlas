# Dependency choices and compatibility

Checked November 7, 2026 against official documentation, package metadata, and actual builds/tests.

- [Spring Boot 4.1 requirements](https://docs.spring.io/spring-boot/system-requirements.html) support Java 21 and Maven 3.6.3+. The project uses Boot 4.1.2 and Maven 3.9.11. Its BOM manages Spring Framework 7.0.10, Spring Security 7.1.2, Hibernate 7, Jackson 3.1.7, Tomcat 11.0.27, and PostgreSQL JDBC 42.7.14. Boot's modular MVC, Flyway, JDBC Session, and MVC-test starters enable their respective features explicitly.
- [springdoc compatibility](https://springdoc.org/) pairs Boot 4 with springdoc 3. The project uses 3.2.0, verified from Maven Central. API tests use Jackson 3's `tools.jackson` namespace.
- [React versions](https://react.dev/versions) and npm metadata were checked; React/ReactDOM are pinned to 19.3.1. This client-rendered app does not install React Server Components packages.
- [Vite requirements](https://vite.dev/guide/) support Node 24. Vite 8.3.6, React plugin 6.2.1, TypeScript 5.9, ESLint 10, and compatible typescript-eslint were resolved and actually built/linted together. `package-lock.json` captures the resolved graph.
- PostgreSQL 17.11 passed verification through the native binary, Testcontainers
  and Compose. The Compose database image applies Alpine security updates and
  replaces the upstream entrypoint's Go-based privilege helper with `su-exec`.
- Compose image builds, startup and container vulnerability review ran on
  November 9, 2026. See [the release review](RELEASE_READINESS.md) for the scan
  results. Container tags remain version-based. The cloud overlay and Caddyfile
  passed local configuration validation.
- Terraform 1.13.5 validates with signed AWS provider 6.72.0; `.terraform.lock.hcl` records checksums. No configuration has been applied.

## Runtime dependency audit

`scripts/audit-maven.mjs` reads Maven's resolved runtime dependency list and queries the [public OSV batch API](https://google.github.io/osv.dev/api/). It sends only public package coordinates and versions, with no credentials or source code. It fails on any advisory match or incomplete/API failure. The final graph of **124 runtime coordinates returned zero advisory matches**. CI includes this read-only check.

The maintained Boot 4 line was selected after reviewing current advisory metadata and [Spring's support/fix guidance](https://spring.io/security/cve-2026-59313/). Fixes for the older Framework 6.2 branch require commercial support. The final project therefore uses the current freely maintained Framework 7 line rather than suppressing those matches.

This is not a claim of exhaustive vulnerability coverage: OSV can omit issues, test/build plugins are outside the runtime list, no native JDK/image scan ran, and the separate OWASP/NVD scan has not run.

## Development-tool security override

The npm audit identified a moderate minimatch denial-of-service advisory in the installed ESLint/typescript-eslint graph (minimatch 10.2.6). Its suggested forced remediation downgraded ESLint to an unsupported version.

Scoped npm overrides pin **minimatch 11.0.5** only under ESLint, `@eslint/config-array`, and `@typescript-eslint/typescript-estree`. Lint/tests/type/build checks run against that resolved graph; a fresh npm audit reports zero vulnerabilities. These are development-only dependencies and absent from the Nginx runtime image. Remove the overrides when upstream dependencies adopt patched versions.

Native verification used a preinstalled Java 21.0.4 JDK. Use a current Java 21 security patch for maintained use; production Dockerfiles select the maintained Temurin 21 image family. Tool downloads, local credentials and reports are ignored and are not source deliverables.
