# ---- Development stage (used by docker-compose.yml) ----
FROM node:22-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json next.config.js tailwind.config.js postcss.config.js ./
COPY src/ src/
COPY public/ public/

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ---- Build stage ----
FROM dev AS builder

ENV BACKEND_URL=http://backend:3001
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Production stage (used by docker-compose.prod.yml) ----
FROM node:22-alpine AS production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
