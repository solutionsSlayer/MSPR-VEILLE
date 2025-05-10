# Use an official Node.js runtime as a parent image
FROM node:20-slim AS base

# Set the working directory in the container
WORKDIR /app

# --- Dependencies Stage ---
FROM base AS deps
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json package-lock.json* ./

# Install dependencies using npm
RUN npm ci

# --- Build Stage ---
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure public directory exists
RUN mkdir -p ./public

# Build the Next.js application
ENV NODE_ENV production
RUN npm run build

# --- Development Stage ---
FROM base AS dev
WORKDIR /app

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set NODE_ENV to development
ENV NODE_ENV development

# Command to run the app in development mode
CMD ["npm", "run", "dev"]

# --- Production Stage ---
FROM base AS production
WORKDIR /app

ENV NODE_ENV production

# Copy only the necessary files for runtime
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/src /app/src
# Ensure services directory is explicitly copied
COPY --from=builder /app/src/services /app/src/services
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Expose the port the app runs on
EXPOSE 3000

# Command to run the app in production mode
CMD ["npm", "run", "start"]

# Note: The 'cron' service in docker-compose.yml uses this same image
# but overrides the CMD to run 'npm run cron:start'.
# Ensure 'ts-node' and 'node-cron' are listed as dependencies in package.json
# so they are available in the final image for the cron service.
