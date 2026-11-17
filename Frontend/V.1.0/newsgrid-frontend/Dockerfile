# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    sed -i 's|https://registry.npmjs.org|https://registry.npmmirror.com|g' package-lock.json 2>/dev/null || true && \
    npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 120000 && \
    npm install --prefer-offline --no-audit --no-fund
COPY . .
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
