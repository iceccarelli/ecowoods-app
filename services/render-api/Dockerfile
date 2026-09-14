# The render API. No build step and no npm install, because there is nothing to
# install: the service has zero dependencies and Node strips the types itself.
#
# The whole monorepo is copied because the service IMPORTS the renderer from
# apps/web/lib/floor-studio rather than vendoring a second copy of it. That is
# the point of the design, and .dockerignore keeps the image small anyway.
FROM node:24-slim

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# --experimental-strip-types is explicit rather than relying on the default so
# the image behaves the same on Node 22 and 24.
CMD ["node", "--experimental-strip-types", "--import", "./services/render-api/src/register.mjs", "./services/render-api/src/server.ts"]
