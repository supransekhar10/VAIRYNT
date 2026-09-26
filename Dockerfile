FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/agent/package.json apps/agent/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci
COPY apps/agent apps/agent
COPY packages/core packages/core
RUN npm run build --workspace @vairynt/core && npm run build --workspace @vairynt/agent \
  && test -f node_modules/@livekit/agents-plugin-silero/dist/silero_vad.onnx
USER node
CMD ["node", "apps/agent/dist/main.js", "start"]
