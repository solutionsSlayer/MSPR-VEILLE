FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV RSS_FETCH_CRON="0 * * * *"

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Set ownership
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Command to run the service
CMD ["node", "dist/services/rss-fetcher/index.js"]
