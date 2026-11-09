FROM node:24-alpine AS build
WORKDIR /build
COPY package*.json .
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM nginxinc/nginx-unprivileged:1.30-alpine-slim
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
