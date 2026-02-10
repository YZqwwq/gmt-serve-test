FROM docker.m.daocloud.io/library/node:16-bullseye

WORKDIR /app

ENV npm_config_registry=https://registry.npmmirror.com
ENV npm_config_disturl=https://npmmirror.com/mirrors/node
ENV npm_config_fetch_retries=5
ENV npm_config_fetch_retry_mintimeout=20000
ENV npm_config_fetch_retry_maxtimeout=120000
ENV npm_config_fetch_timeout=120000
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
ENV SHARP_DIST_BASE_URL=https://npmmirror.com/mirrors/sharp-libvips/v8.14.5/
ENV npm_config_sharp_binary_host=https://npmmirror.com/mirrors/sharp
ENV npm_config_sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips

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
