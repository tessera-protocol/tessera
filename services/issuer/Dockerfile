FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/
RUN mkdir -p data

EXPOSE 3001

CMD ["node", "dist/server.js"]
