FROM node:22-slim

WORKDIR /app

# Configure fast npm mirror & cache
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev

COPY src ./src
COPY cloudflare-worker.js ./

VOLUME ["/app/data"]

ENV NODE_ENV=production

CMD ["node", "--no-warnings", "src/index.js"]