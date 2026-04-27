# ---- Development stage (used by docker-compose.yml) ----
FROM node:22-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json tsconfig.build.json nest-cli.json* ./
COPY src/ src/

EXPOSE 3001

CMD ["npm", "run", "dev"]

# ---- Build stage ----
FROM dev AS builder

RUN npm run build

# ---- Production stage (used by docker-compose.prod.yml) ----
FROM node:22-alpine AS production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
