# The game server. Build:  docker build -t steal-a-poop-server .   Run:  docker run -p 8080:8080 --env-file server.env steal-a-poop-server
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:server

FROM node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
# only what the server needs at run time
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist-server ./dist-server
COPY public/words.txt ./public/words.txt
# the bots judge how rare a word is from this list (src/engine/rarity.ts); without it they fall back to a rough guess
COPY public/word-frequency.txt ./public/word-frequency.txt
COPY server/data ./server/data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/main.mjs"]
