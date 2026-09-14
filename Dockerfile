FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

# Railway Volume se monta en /data
ENV DATA_DIR=/data
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
