# GetCardy merchant portal

Next.js merchant back office for GetCardy. It talks to the Medusa backend
(`apps/backend`) through `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.

## Run locally

Prerequisites: Node.js >= 22.22 and pnpm 10.11.1 (see `packageManager` in the
root `package.json`).

1. From the repository root, install the portal's dependencies:
   `pnpm install --filter @dtc/portal...`
2. Copy `.env.example` to `.env` and set `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.
3. Start the dev server: `pnpm --filter @dtc/portal dev`

Other scripts: `pnpm --filter @dtc/portal build`, `lint` and `start`.

## Deploy (Dokploy)

The image is built from the repository root with `Dockerfile.monorepo`, which
installs from the root `pnpm-lock.yaml`. See the comment at the top of that
file for the exact Dokploy settings (Build Path, Docker File, Docker Context
Path) and the rollback to `apps/portal/Dockerfile`.

`NEXT_PUBLIC_MEDUSA_BACKEND_URL` is baked into the build, so changing it needs
a new deploy, not just a restart.
