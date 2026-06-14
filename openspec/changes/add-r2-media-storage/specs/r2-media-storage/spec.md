## ADDED Requirements

### Requirement: Conditional R2 storage
The system SHALL use Cloudflare R2 for Payload media uploads when all required R2 environment variables are configured, and SHALL retain local file storage when none are configured.

#### Scenario: Complete R2 configuration
- **WHEN** all required R2 environment variables are present
- **THEN** the Payload media collection uses the S3-compatible R2 storage adapter

#### Scenario: Local development without R2
- **WHEN** no R2 environment variables are present
- **THEN** media uploads continue using the local `public/media` directory

#### Scenario: Incomplete R2 configuration
- **WHEN** at least one but not all required R2 environment variables are present
- **THEN** configuration fails with an error that identifies the missing variables

### Requirement: Public media URLs
The system SHALL generate public media URLs from `R2_PUBLIC_URL` rather than the private R2 S3 API endpoint.

#### Scenario: Generate an R2 media URL
- **WHEN** Payload stores a media file in R2
- **THEN** its public URL begins with the normalized `R2_PUBLIC_URL` and includes the stored object key

#### Scenario: Public URL has a trailing slash
- **WHEN** `R2_PUBLIC_URL` ends with one or more slashes
- **THEN** the generated media URL contains exactly one slash between the host and object key

### Requirement: Next.js remote image support
The system SHALL allow Next.js Image to optimize images served from the configured R2 public URL.

#### Scenario: R2 public URL is configured
- **WHEN** Next.js builds with `R2_PUBLIC_URL`
- **THEN** the corresponding protocol, hostname, optional port, and path are included in the image remote patterns

#### Scenario: R2 public URL is absent
- **WHEN** Next.js builds without `R2_PUBLIC_URL`
- **THEN** no R2 remote image pattern is added

### Requirement: Deployment configuration documentation
The system SHALL document every environment variable required to connect Payload to R2 and serve public media.

#### Scenario: Operator prepares Vercel configuration
- **WHEN** the operator reads the example environment file
- **THEN** the bucket, endpoint, access key, secret key, fixed `auto` region, and public URL settings are documented without real credentials
