FROM docker.m.daocloud.io/library/node:16-bullseye

WORKDIR /app

ENV npm_config_registry=https://registry.npmmirror.com
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
ENV SHARP_DIST_BASE_URL=https://npmmirror.com/mirrors/sharp-libvips/v8.14.5/

COPY package.json package-lock.json ./
RUN npm ci

RUN npx playwright install --with-deps chromium

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=18081
EXPOSE 18081

CMD ["node","dist/index.js"]
