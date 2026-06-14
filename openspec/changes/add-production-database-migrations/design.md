## Context

Local development uses Payload/Drizzle push mode, while production Postgres should be updated through committed migrations. Neon provides the production PostgreSQL database and Vercel runs the application build.

## Goals / Non-Goals

**Goals:**

- Capture the complete current Payload schema in an initial migration.
- Apply pending migrations before every Vercel production build.
- Make migration failures stop deployment.
- Keep credentials outside source control.

**Non-Goals:**

- Do not manually create tables in Neon.
- Do not run destructive reset or fresh commands against production.
- Do not seed production content automatically during deployment.

## Decisions

1. Generate migrations with Payload CLI so schema matches the current Payload config.
2. Add `ci` as `npm run payload migrate && npm run build`, and version Vercel's `buildCommand` in `vercel.json` so every deployment uses it.
3. Keep normal `build` unchanged so local builds do not unexpectedly modify a database.
4. Commit the generated migration and index so future schema changes can be incrementally generated.

## Risks / Trade-offs

- [Wrong `DATABASE_URL`] → Migration could target the wrong database; Vercel variables must be scoped and reviewed.
- [Concurrent deployments] → Payload migration tracking and transactions reduce risk, but production deployments should remain serialized.
- [Migration failure] → Deployment stops before build, preserving the previous working deployment.

## Migration Plan

1. Generate and review the initial migration.
2. Push migration files to GitHub.
3. Set Neon `DATABASE_URL` in Vercel.
4. Set Vercel Build Command to `npm run ci`.
5. Deploy and verify Payload migration status plus `/admin`.
