## ADDED Requirements

### Requirement: Immediate database-backed publishing
The system SHALL persist article drafts, publications, updates, schedules, and unpublishing operations in a runtime content database without requiring a Git commit, application build, or redeployment.

#### Scenario: Author publishes an eligible article
- **WHEN** an authorized author publishes a valid article whose publication time is not in the future
- **THEN** the article becomes available to public routes and discovery queries without a redeployment

#### Scenario: Author saves a draft
- **WHEN** an authorized author saves an article as a draft
- **THEN** the system persists it for later editing and excludes it from every public response

#### Scenario: Author unpublishes an article
- **WHEN** an authorized author changes a published article to an unpublished state
- **THEN** public routes, search, feeds, and sitemaps stop exposing it while the editable record remains available in administration

### Requirement: Restricted administration and write APIs
The system MUST require a valid Supabase Auth session whose email is present in the configured administrator allowlist for every administration read or write operation, and MUST keep server secret credentials outside browser code and responses.

#### Scenario: Allowed administrator writes content
- **WHEN** a signed-in user with an allowlisted email submits a valid administration request
- **THEN** the server performs the requested operation with its server-only content client

#### Scenario: Anonymous or unlisted user calls an API
- **WHEN** a request has no valid access token or belongs to an email outside the administrator allowlist
- **THEN** the server returns an authorization error without exposing drafts, secrets, or write capability

### Requirement: Runtime article validation
The system SHALL validate article title, unique slug, description, body, status, publication dates, content type, category, tags, SEO values, and cover metadata before persistence.

#### Scenario: Invalid article is submitted
- **WHEN** required data is missing, malformed, unsafe, or conflicts with an existing slug
- **THEN** the write is rejected with field-level actionable errors and no partial public update

#### Scenario: Future publication is saved
- **WHEN** an article is published with a future publication time
- **THEN** it remains absent from public queries until that time is reached

### Requirement: Managed image uploads
The administration interface SHALL allow an authorized author to upload JPEG, PNG, WebP, or AVIF images up to 5 MB to managed object storage using unique immutable paths, and SHALL require alternative text for article covers.

#### Scenario: Valid cover is uploaded
- **WHEN** an authorized author uploads an allowed image within the size limit
- **THEN** the system stores it at a unique path and returns public media metadata usable by the article editor

#### Scenario: Invalid media is uploaded
- **WHEN** an upload exceeds the size limit or uses a disallowed content type
- **THEN** the server rejects it with a clear error and does not persist the object

### Requirement: Dynamic published-content search
The system SHALL search the current set of eligible published articles at request time and MUST exclude draft, unpublished, and future-dated records.

#### Scenario: Newly published article matches a search
- **WHEN** a reader searches for terms present in an article published after the last application deployment
- **THEN** the results include that article without requiring a rebuilt client-side index

#### Scenario: Private article matches a search
- **WHEN** search terms match only a draft, unpublished, or future-dated article
- **THEN** the system returns no result for that private article

### Requirement: Reproducible data migration
The repository SHALL include an idempotent database schema and an import path for existing article, taxonomy, and site data, while retaining the original Git content as a rollback source during migration.

#### Scenario: New environment is prepared
- **WHEN** an operator applies the migration to an empty supported Supabase project
- **THEN** all required tables, indexes, access policies, defaults, and media storage configuration exist

#### Scenario: Local tests run without Supabase
- **WHEN** required Supabase environment values are absent outside production
- **THEN** the application uses deterministic fixture content for development and automated validation
