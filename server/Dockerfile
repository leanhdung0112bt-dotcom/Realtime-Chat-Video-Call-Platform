FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
RUN npm run check && mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
