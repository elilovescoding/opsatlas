FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src src
RUN mvn -B -ntp package -DskipTests
FROM eclipse-temurin:21-jre-noble
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    && groupadd --system opsatlas && useradd --system --gid opsatlas opsatlas
WORKDIR /app
COPY --from=build --chown=opsatlas:opsatlas /build/target/opsatlas-1.0.0.jar app.jar
USER opsatlas
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080 8081
HEALTHCHECK --interval=20s --timeout=5s --start-period=50s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:8081/actuator/health/readiness || exit 1
ENTRYPOINT ["java","-jar","/app/app.jar"]
