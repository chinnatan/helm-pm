# build from the repo root:  docker build -f tools/vault-sync/Dockerfile -t helm-vault-sync .
FROM oven/bun:1-slim
WORKDIR /app
COPY tools/vault-sync/package.json tools/vault-sync/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY tools/vault-sync/src ./src
# /state is world-writable so a named volume works with any uid chosen in compose
RUN mkdir /state && chmod 777 /state
ENV VAULT_DIR=/vault STATE_DIR=/state ALIAS_FILE=/config/aliases.json
USER bun
ENTRYPOINT ["bun", "src/cli.ts"]
