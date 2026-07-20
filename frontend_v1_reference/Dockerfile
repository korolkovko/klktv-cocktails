# ---------- Build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Serve stage ----------
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Only substitute the variables WE want — leaves nginx's own $vars
# (like $proxy_host, $request_uri, $remote_addr) untouched.
ENV NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_URL)$"

ENV PORT=80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
