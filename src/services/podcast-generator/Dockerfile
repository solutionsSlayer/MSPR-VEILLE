FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Create non-root user early
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Create directories with correct ownership from the start
RUN mkdir -p /app/dist /app/public/podcasts && \
    chown appuser:nodejs /app /app/dist /app/public /app/public/podcasts

# Switch to non-root user for the rest of the build
USER appuser

# Copy source code
COPY --chown=appuser:nodejs . .

# Build TypeScript code
RUN npm run build

# Environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PODCAST_GEN_CRON="0 */6 * * *"
ENV PODCAST_GEN_BATCH_SIZE=5
ENV PODCASTS_DIR=/app/public/podcasts

# Command to run the service
CMD ["node", "dist/services/podcast-generator/index.js"]
