# Multi-stage build for the panel.
#
# The runtime image carries only the built application plus the data files that
# are read at run time: the common-password list, the PDF fonts and the SQL
# migrations.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---------- dependencies ----------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A build-time placeholder: nothing connects to the database while building
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV SESSION_SECRET=build-time-placeholder-secret
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------- runtime ----------
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

# Runs as a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

# Read at run time, so they have to be in the image
COPY --from=build /app/data ./data
COPY --from=build /app/assets ./assets
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/emails ./emails
COPY --from=build /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3001

# Migrations are applied on start, then the server takes over
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
