FROM node:20-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm config set update-notifier false && npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
