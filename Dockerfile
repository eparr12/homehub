# The image the host runs (build-plan step 1.8). Both stages start from one
# base, pinned by digest so that a new Node image reaches the host only
# through a Dependabot pull request. Its major follows .nvmrc.
FROM node:26-slim@sha256:abe7e5a82b61a8ef67b315b85497c9e65173387ccf2f4a029248184b8e020be5 AS base
WORKDIR /app

# The web build, which needs every dependency. .dockerignore keeps the tests
# out.
FROM base AS build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY vite.config.ts tsconfig.base.json ./
COPY src ./src
# Without index.html the server would answer /api alone and still report
# healthy.
RUN npm run build && test -f dist/web/index.html

FROM base AS runtime
# compose.yaml sets these again, so that .env can't change them. No EXPOSE:
# docker run -P would publish the port on every interface (SEC-2).
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
# A new volume takes its owner from the folder it's mounted on, so this is
# what lets node write to the database volume.
RUN mkdir /data && chown node:node /data
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY --from=build /app/dist/web ./dist/web
# Not root, and the app's files stay root's (SEC-9).
USER node
# The server listens only after its backup and migrations, so the start
# period keeps a slow first start from counting as failures: never below 60 s.
# The start interval shows a healthy start within about 3 s.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s --start-interval=2s \
  CMD ["node", "--eval", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]
# Links the package to the repo when it's first pushed.
LABEL org.opencontainers.image.source=https://github.com/eparr12/homehub
# Last, so that builds that differ only in the commit differ only here: the
# web build stays the same, and phones get no "new version" prompt for a
# merge that changed no web source.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
# The exec form makes node PID 1, so it gets docker stop's SIGTERM and shuts
# down within the stop timeout (SRV-8). Under a shell it would be killed.
CMD ["node", "src/server/main.ts"]
