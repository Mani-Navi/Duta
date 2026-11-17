# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    sed -i 's|https://registry.npmjs.org|https://registry.npmmirror.com|g' package-lock.json 2>/dev/null || true && \
    npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 120000 && \
    npm install --prefer-offline --no-audit --no-fund
COPY . .
EXPOSE 4000
CMD ["node", "index.js"]
