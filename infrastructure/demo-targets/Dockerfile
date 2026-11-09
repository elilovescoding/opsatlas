FROM node:24-trixie-slim
# Fixtures use the Node standard library only. Leave package managers out of the runtime.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v*
USER node
