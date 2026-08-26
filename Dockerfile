# Fairprice production image.
#
# Coolify v4's Nixpacks builder pins a nixpkgs snapshot whose newest Node is
# 22.11.0, below the 22.12 minimum that Prisma 7 requires. Building from the
# official Node image keeps the runtime on the same node:lts line the previous
# server used.
FROM node:22-slim

WORKDIR /app

# prisma migrate deploy runs the schema engine, which links against OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# devDependencies stay installed: npm start runs the prisma CLI, and the
# Next.js build needs typescript and tailwind.
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
