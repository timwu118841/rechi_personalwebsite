## ADDED Requirements

### Requirement: Versioned initial schema
The system SHALL include a Payload migration that creates the database schema required by the current collections, globals, localization, versions, and plugins.

#### Scenario: Empty Neon database
- **WHEN** the initial migration runs against an empty Neon database
- **THEN** the required Payload tables, relations, indexes, enums, and migration tracking records are created

### Requirement: Migration-first production build
The system SHALL provide a CI command that applies all pending Payload migrations before running the Next.js production build, and SHALL configure Vercel to use that command.

#### Scenario: Pending migration succeeds
- **WHEN** Vercel executes the CI command with a valid production `DATABASE_URL`
- **THEN** pending migrations complete before the application build starts

#### Scenario: Migration fails
- **WHEN** a pending migration cannot be applied
- **THEN** the CI command exits unsuccessfully and the production build does not continue

### Requirement: Safe development workflow
The system SHALL preserve the existing local development and build commands without automatically applying production migrations.

#### Scenario: Local build
- **WHEN** a developer runs the normal build command
- **THEN** the project builds without first executing database migrations

### Requirement: Deployment documentation
The system SHALL document how to configure Neon and Vercel to execute production migrations without committing credentials.

#### Scenario: Vercel setup
- **WHEN** an operator prepares the Vercel deployment
- **THEN** the documented steps identify the required `DATABASE_URL`, CI build command, and migration status check
