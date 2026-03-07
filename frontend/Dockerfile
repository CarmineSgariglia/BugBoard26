FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm config set update-notifier false && npm ci

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
