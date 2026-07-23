FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/domain/package.json packages/domain/
COPY packages/observability/package.json packages/observability/
COPY packages/infra/package.json packages/infra/
COPY packages/test-utils/package.json packages/test-utils/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
RUN pnpm --filter @atlas/config build \
 && pnpm --filter @atlas/domain build \
 && pnpm --filter @atlas/observability build \
 && pnpm --filter @atlas/infra db:generate \
 && pnpm --filter @atlas/infra build \
 && pnpm --filter @atlas/api build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @atlas/infra db:migrate && pnpm --filter @atlas/infra db:seed && node dist/index.js"]
