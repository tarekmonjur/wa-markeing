# ---- Development stage (used by docker-compose.yml) ----
FROM node:22-alpine AS dev

RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ src/

EXPOSE 3002

CMD ["npm", "run", "dev"]

# ---- Build stage ----
FROM dev AS builder

RUN npm run build

# ---- Production stage (used by docker-compose.prod.yml) ----
FROM node:22-alpine AS production

RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3002

CMD ["npm", "run", "start"]
