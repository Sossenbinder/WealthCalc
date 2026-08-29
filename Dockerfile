# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked in at build time: the canonicals, the sitemap and the sitemap reference
# in robots.txt are absolute, so the image is tied to the host it is served on.
ARG NEXT_PUBLIC_SITE_URL=https://wealthcalc.dotschranz.net
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# ---- runtime ----
FROM nginx:1.29-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/out /usr/share/nginx/html
EXPOSE 80
