# Use an official Node.js runtime as a parent image
FROM node:20-slim AS base

# Set the working directory in the container
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml first to leverage Docker cache
COPY package.json pnpm-lock.yaml* ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (default Next.js port)
EXPOSE 3000

# --- Development Stage (Optional) ---
FROM base AS dev
# Set NODE_ENV to development
ENV NODE_ENV development
# Command to run the app in development mode (using Next.js dev server)
CMD ["pnpm", "dev"]


# --- Build Stage ---
FROM base AS builder
# Set NODE_ENV to production for build
ENV NODE_ENV production
# Build the Next.js application
RUN pnpm build


# --- Production Stage ---
FROM base AS production
# Set NODE_ENV to production
ENV NODE_ENV production

# Copy built assets from the builder stage
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
# Copy node_modules (already installed in 'base' stage, pnpm handles linking)
# Ensure necessary runtime dependencies are available

# Command to run the app in production mode
CMD ["pnpm", "start"]

# Note: The 'cron' service in docker-compose.yml uses this same image
# but overrides the CMD to run 'pnpm run cron:start'.
# Ensure 'ts-node' and 'node-cron' are listed as dependencies in package.json
# so they are available in the final image for the cron service.
# If cron:start directly executes a JS file after build, ts-node might not be needed
# in the production stage itself, only for local dev or if the cron script isn't compiled.
# The current setup uses ts-node, so it MUST be in dependencies (not devDependencies).
