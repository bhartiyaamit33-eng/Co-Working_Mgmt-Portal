FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

COPY frontend/ .
# Empty backend URL → frontend calls same-origin /api (nginx proxies it).
ENV REACT_APP_BACKEND_URL=
ENV NODE_OPTIONS=--max_old_space_size=2048
RUN yarn build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
