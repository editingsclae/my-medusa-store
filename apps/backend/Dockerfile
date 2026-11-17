# Backend image for Dokploy (Build Type: Dockerfile).
#
# No secret is passed as a build argument. Dokploy gives the Environment tab
# values to the RUNNING container only, so they never end up in the image.
# The same steps as before (nixpacks.toml): install, medusa build, copy the admin.
FROM node:24-bookworm

WORKDIR /app
ENV NODE_ENV=production

# Install first, so this layer is reused when only the source changes.
# patch-package (postinstall) needs the patches folder.
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci --include=dev --legacy-peer-deps

COPY . .

# medusa build needs no secret: the config is compiled and reads the variables at run time.
RUN npm run build \
 && mkdir -p public \
 && rm -rf ./public/admin \
 && cp -r .medusa/server/public/admin ./public/admin

EXPOSE 9000

# "start" runs the database migrations and then the server (see package.json).
CMD ["npm", "run", "start"]
