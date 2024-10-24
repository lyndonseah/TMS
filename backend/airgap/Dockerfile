# Stage 1: Build Stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy only necessary files for installing dependencies
COPY backend-1.0.0.tgz .
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install backend-1.0.0.tgz --no-save

# Extract node_modules
RUN mkdir /tmp/backend && \
    tar -xzf backend-1.0.0.tgz -C /tmp/backend && \
    diff /tmp/backend/package/package.json package.json && \
    cp -r /tmp/backend/package/node_modules ./node_modules && \
    rm -rf /tmp/backend backend-1.0.0.tgz

# Stage 2: Final Image
FROM node:18-alpine

ENV NODE_ENV=production

RUN adduser -S -D -H -u 1001 -s /bin/ash appuser

WORKDIR /app

# Copy application files from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Copy application source code
COPY server.js ./
COPY config/ ./config/
COPY controllers/ ./controllers/
COPY routes/ ./routes/

EXPOSE 3000

USER appuser

CMD ["node", "server.js"]
