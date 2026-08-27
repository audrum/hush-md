FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY packages/envelope/package.json packages/envelope/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY . .
RUN npm run build:web

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
COPY --from=build /app/packages/envelope packages/envelope
COPY --from=build /app/packages/server packages/server
COPY --from=build /app/packages/web/dist packages/web/dist
RUN npm ci --omit=dev && npm install tsx
ENV DATA_DIR=/data STATIC_DIR=/app/packages/web/dist PORT=8080
EXPOSE 8080
CMD ["npx", "tsx", "packages/server/src/index.ts"]
