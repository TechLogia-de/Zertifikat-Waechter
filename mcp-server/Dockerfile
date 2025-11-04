# Multi-stage Build für MCP-Server
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies installieren (inkl. devDependencies für Build)
COPY package*.json ./
RUN npm ci || npm install

# Source kopieren und kompilieren
COPY . .
RUN npm run build

# Production Image
FROM node:20-alpine

WORKDIR /app

# Sicherheit
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Production dependencies separat installieren
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Build output und manifest kopieren
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/manifest.json ./

USER nodejs

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

CMD ["node", "dist/server.js"]

