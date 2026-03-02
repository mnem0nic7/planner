# Stage 1: Build
FROM node:22-slim AS build

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy workspace package.json files for dependency install
COPY server/package.json server/package.json
COPY client/package.json client/package.json

# Copy Prisma schema (needed for prisma generate during install)
COPY server/prisma/schema.prisma server/prisma/schema.prisma

# Install all dependencies (workspaces resolved automatically)
RUN npm ci

# Copy source code
COPY server/ server/
COPY client/ client/
COPY tsconfig.json tsconfig.json

# Generate Prisma client
RUN npx prisma generate --schema=server/prisma/schema.prisma

# Build server (tsc) and client (vite)
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Stage 2: Production
FROM node:22-slim AS production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy Prisma schema and generated client from build stage
COPY server/prisma/schema.prisma server/prisma/schema.prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma

# Copy built server
COPY --from=build /app/server/dist server/dist

# Copy built client
COPY --from=build /app/client/dist client/dist

# Create non-root user and data directory
RUN addgroup --system app && adduser --system --ingroup app app
RUN mkdir -p /app/data && chown app:app /app/data

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/planner.db
ENV PORT=3001

EXPOSE 3001

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server/dist/index.js"]
