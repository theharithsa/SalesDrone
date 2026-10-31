FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY functions/package.json functions/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace functions --ignore-scripts && npm cache clean --force
COPY functions/src functions/src
COPY services/ingress services/ingress
USER node
CMD ["node", "services/ingress/src/server.js"]
