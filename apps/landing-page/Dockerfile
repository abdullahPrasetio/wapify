# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_LICENSE_API=https://wapbolt-api.temancode.my.id
ENV VITE_LICENSE_API=$VITE_LICENSE_API

COPY package*.json ./
RUN npm install --force
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
