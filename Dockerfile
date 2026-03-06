
FROM node:20-slim AS builder


RUN apt-get update && \
  apt-get install -y --no-install-recommends curl dnsutils && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app


COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set fetch-timeout 300000 && \
  npm config set fetch-retries 5 && \
  npm config set fetch-retry-mintimeout 20000 && \
  npm config set fetch-retry-maxtimeout 120000 && \
  npm ci && \
  npm install prisma@^6.18.0 @prisma/client@^6.18.0 && \
  npm cache clean --force


COPY . .

RUN echo "🔍 Testing Prisma CDN connectivity..." && \
  echo "DNS resolution test:" && \
  nslookup binaries.prisma.sh || echo "DNS lookup failed" && \
  echo "HTTP connectivity test:" && \
  curl -v --max-time 30 --connect-timeout 10 https://binaries.prisma.sh/ 2>&1 | head -10 || echo "CDN connectivity test completed"


ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
ENV PRISMA_ENGINES_MIRROR=""
ENV NODE_OPTIONS="--max-old-space-size=4096"

ENV PRISMA_ENGINES_DOWNLOAD_TIMEOUT=300000

RUN echo "🚀 Starting Prisma Client generation..." && \
  GENERATION_SUCCESS=false && \
  for i in 1 2 3 4 5; do \
  echo "" && \
  echo "════════════════════════════════════════" && \
  echo "📦 Attempt $i/5: Generating Prisma Client..." && \
  echo "════════════════════════════════════════" && \
  npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tee /tmp/prisma-generate.log || true && \
  if [ -d "node_modules/.prisma" ] && [ -f "node_modules/.prisma/client/index.js" ] && [ -f "node_modules/.prisma/client/index.d.ts" ] && [ -d "node_modules/@prisma/client" ]; then \
  echo "✅ Prisma Client files verified!" && \
  echo "📁 Generated files:" && \
  ls -lah node_modules/.prisma/client/ | head -10 && \
  echo "📄 Checking index.d.ts content..." && \
  head -50 node_modules/.prisma/client/index.d.ts | grep -E "(User|UserRole|Project|TimeEntry)" || echo "No model types found" && \
  if grep -qE "(export type User|export \{ User \}|export type.*User)" node_modules/.prisma/client/index.d.ts 2>/dev/null; then \
  echo "✅ TypeScript types found!" && \
  GENERATION_SUCCESS=true && \
  break; \
  else \
  echo "❌ TypeScript types not found in generated client" && \
  echo "First 20 lines of index.d.ts:" && \
  head -20 node_modules/.prisma/client/index.d.ts || echo "Cannot read file"; \
  fi; \
  else \
  echo "❌ Prisma Client files missing after generation" && \
  echo "Checking what was created:" && \
  ls -la node_modules/.prisma/ 2>/dev/null || echo "No .prisma directory" && \
  ls -la node_modules/@prisma/ 2>/dev/null || echo "No @prisma directory"; \
  fi && \
  if [ "$GENERATION_SUCCESS" = "false" ] && [ $i -lt 5 ]; then \
  echo "⏳ Waiting $((i * 20)) seconds before retry..." && \
  sleep $((i * 20)); \
  fi; \
  done && \
  if [ "$GENERATION_SUCCESS" != "true" ]; then \
  echo "" && \
  echo "❌ ERROR: Prisma Client generation failed after 5 attempts" && \
  echo "Last error log:" && \
  tail -100 /tmp/prisma-generate.log 2>/dev/null || echo "No log available" && \
  echo "" && \
  echo "Checking node_modules structure:" && \
  ls -la node_modules/ | grep -E "(prisma|@prisma)" || echo "No Prisma directories found" && \
  echo "" && \
  echo "Network diagnostics:" && \
  curl -I https://binaries.prisma.sh/ 2>&1 | head -5 || echo "Cannot reach Prisma CDN" && \
  exit 1; \
  fi && \
  echo "" && \
  echo "✅ Prisma Client generation completed successfully!"


RUN echo "🔍 Verifying Prisma Client before build..." && \
  if [ ! -f "node_modules/.prisma/client/index.d.ts" ]; then \
  echo "❌ ERROR: Prisma Client types not found!" && \
  echo "Checking node_modules:" && \
  ls -la node_modules/.prisma/ 2>/dev/null || echo "No .prisma directory" && \
  exit 1; \
  fi && \
  echo "✅ Prisma Client verified, starting build..."


RUN npm run build

FROM node:20-slim

WORKDIR /app

RUN apt-get update && \
  apt-get install -y --no-install-recommends wget netcat-openbsd postgresql-client && \
  rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set fetch-timeout 300000 && \
  npm config set fetch-retries 5 && \
  npm config set fetch-retry-mintimeout 20000 && \
  npm config set fetch-retry-maxtimeout 120000 && \
  npm ci --omit=dev --ignore-scripts && \
  npm install prisma@^6.18.0 @prisma/client@^6.18.0 && \
  npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma


COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh


RUN mkdir -p uploads/screenshots uploads/thumbnails


EXPOSE 3001


HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["node", "dist/main"]

