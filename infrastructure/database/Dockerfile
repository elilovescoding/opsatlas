FROM postgres:17.11-alpine
# Keep the official init script and Alpine data compatibility. Its gosu call only drops privileges.
RUN apk upgrade --no-cache && apk add --no-cache su-exec \
    && ln -sf /sbin/su-exec /usr/local/bin/gosu
