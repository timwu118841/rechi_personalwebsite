## Why

Neon production database is empty and Payload Postgres requires a schema matching the configured collections and globals. The project needs a versioned initial migration and a deployment command that applies pending migrations before Vercel builds the application.

## What Changes

- Add an initial Payload Postgres migration generated from the current configuration.
- Add a CI build script that runs pending migrations before the production build.
- Document the Neon and Vercel migration workflow.
- Add regression coverage for the deployment script and migration artifacts.

## Capabilities

### New Capabilities

- `production-database-migrations`: Version and apply Payload Postgres schema changes before production deployments.

### Modified Capabilities

None.

## Impact

- Adds generated files under `src/migrations`.
- Updates package scripts and deployment documentation.
- Vercel builds will require a valid `DATABASE_URL` and database DDL permissions.
