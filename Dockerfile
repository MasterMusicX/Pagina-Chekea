FROM node:20-bookworm-slim

WORKDIR /app

# git y ca-certificates requeridos por @whiskeysockets/baileys (sin Chromium ni Puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p .wwebjs_auth

CMD ["npm", "start"]
