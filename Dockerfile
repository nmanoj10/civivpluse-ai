# Stage 1: Build both frontend and backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev dependencies required for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Run the build script (Vite for frontend + ESBuild for backend)
RUN npm run build


# Stage 2: Production runtime environment
FROM node:22-alpine AS production

WORKDIR /app

# Install only production dependencies to keep the image small
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the built assets from the builder stage
COPY --from=builder /app/dist ./dist

# Set production environment variable
ENV NODE_ENV=production

# Cloud Run injects the PORT environment variable dynamically (defaults to 8080)
# Our backend defaults to 6000, but respects process.env.PORT.
EXPOSE 6000
EXPOSE 8080

# Start the Node backend, which will also serve the static Vite frontend
CMD ["node", "dist/server.cjs"]
