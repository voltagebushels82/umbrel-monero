FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY ui/package.json ui/package-lock.json ./ui/
RUN npm ci --prefix ui
COPY . .
RUN npm run build && npm run build:ui && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/ui/dist ./ui/dist
COPY app.js ./
COPY bin ./bin
COPY logic ./logic
COPY middlewares ./middlewares
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY utils ./utils
EXPOSE 8889
CMD ["npm", "start"]
