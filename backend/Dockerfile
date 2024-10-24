FROM node:18-alpine

ENV NODE_ENV=production

RUN adduser -S -D -H -u 1001 -s /bin/ash appuser

WORKDIR /app
RUN chown root:root /app

# COPY package*.json ./
COPY . .

RUN npm ci --only=production

# COPY . .

RUN chown -R root:root /app && \
    chmod -R 555 /app

EXPOSE 3000

USER appuser

CMD ["node", "server.js"]
