# =================================================================
# Stage 1: The Builder
# This stage installs all dependencies and compiles the TypeScript
# =================================================================
FROM node:20-slim AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker's layer caching.
# This step will only be re-run if these files change.
COPY package*.json ./

# Install all dependencies, including devDependencies needed for building
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# =================================================================
# Stage 2: The Runner (Final Image)
# This stage creates the final, lean, and secure production image
# =================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Copy package files again
COPY package*.json ./

# Install *only* production dependencies. This makes the image smaller.
RUN npm ci --only=production

# Copy the compiled JavaScript from the 'builder' stage.
# We are NOT copying the source TypeScript files or devDependencies.
COPY --from=builder /app/dist ./dist

# Create and switch to a non-root user for security.
# Running containers as root is a major security risk.
USER node

# Define the command to run the application when the container starts.
# This will execute: node dist/server.js --stdio
CMD ["node", "dist/server.js", "--stdio"]