package dev.opsatlas;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info =
        @Info(
            title = "OpsAtlas API",
            version = "1.0.0",
            description =
                "Single-team service operations. Sign in through the web application for cookie authentication. Mutations additionally require X-CSRF-TOKEN from GET /api/auth/csrf. Viewer accounts cannot mutate operational records. Logout is POST /api/auth/logout (204)."),
    servers = @Server(url = "/"),
    security = @SecurityRequirement(name = "csrf"))
@SecurityScheme(
    name = "csrf",
    type = SecuritySchemeType.APIKEY,
    in = SecuritySchemeIn.HEADER,
    paramName = "X-CSRF-TOKEN",
    description =
        "Required for mutations. Obtain a token from GET /api/auth/csrf in this browser session.")
class OpenApiConfig {}
