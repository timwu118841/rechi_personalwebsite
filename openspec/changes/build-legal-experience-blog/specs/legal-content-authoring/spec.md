## ADDED Requirements

### Requirement: Invite-only administration
The system MUST provide an authenticated CMS administration area that is accessible only to explicitly invited users and MUST NOT allow public registration or anonymous content changes.

#### Scenario: Invited author signs in
- **WHEN** an invited author completes the configured authentication flow
- **THEN** the system grants access to the article administration interface

#### Scenario: Unauthenticated visitor opens the admin URL
- **WHEN** a visitor without a valid authorized session requests an administration route or write API
- **THEN** the system denies write access and does not expose CMS secrets or unpublished content

### Requirement: Browser-based article editing
The CMS SHALL allow an authorized author to create and edit articles through labeled form controls and a rich long-form editor without requiring Git, Markdown, command-line, or deployment knowledge.

#### Scenario: Author creates an article
- **WHEN** an authorized author enters the required metadata and formatted body in the CMS and saves it
- **THEN** the CMS validates and persists the structured article while presenting actionable field errors when validation fails

### Requirement: CMS-managed content categories
The CMS SHALL allow an authorized author to manage article categories as content sections without changing application code. Each category MUST have a stable key, display name, description, display order, and visibility state, and article editing MUST select a managed category rather than accept an unrestricted category value.

#### Scenario: Author creates a content section
- **WHEN** an authorized author creates a visible category in the CMS
- **THEN** the category becomes selectable for articles and appears in the public category index after the next successful build

#### Scenario: Author edits a content section
- **WHEN** an authorized author changes a category display name, description, or display order
- **THEN** the next successful build reflects those changes without requiring a source-code change

#### Scenario: Author hides a content section
- **WHEN** an authorized author disables a category
- **THEN** the next successful build omits it from category discovery while preserving its content record and article relationships

### Requirement: CMS-managed content types
The CMS SHALL allow an authorized author to create and rename reusable content types, such as legal articles, personal essays, or reading notes, without changing application code. Article editing MUST select a managed content type, while categories MUST remain a separate taxonomy concept.

#### Scenario: Author creates a content type
- **WHEN** an authorized author creates a content type in the CMS
- **THEN** the type becomes selectable in article editing after it is saved

#### Scenario: Author distinguishes type from category
- **WHEN** an authorized author edits an article
- **THEN** the interface presents content type and article category as separately labeled relationships

#### Scenario: Author navigates the administration area
- **WHEN** an authorized author opens the CMS dashboard
- **THEN** article editing appears under a content-editing section while content types and categories appear under a separate content-settings section

### Requirement: Managed editorial lifecycle
The CMS SHALL support draft, published, and unpublished states, formatted author preview, publication date, update date, and a clear publish or unpublish action. Public build artifacts MUST contain only published, eligible articles.

#### Scenario: Author saves a draft
- **WHEN** an authorized author saves an article without publishing it
- **THEN** the CMS preserves the draft for later editing and the production site does not expose it

#### Scenario: Author publishes without using Git
- **WHEN** an authorized author chooses publish for a valid article
- **THEN** the CMS persists the published state, versions the content in the repository, and triggers the configured build workflow without requiring the author to use Git

#### Scenario: Author unpublishes an article
- **WHEN** an authorized author chooses unpublish for a published article
- **THEN** the next successful production build removes it from public routes and all discovery artifacts while preserving its editable content and history

### Requirement: CMS media management
The CMS SHALL allow authorized authors to upload and select article cover and inline images, require meaningful alternative text for content images, and store media in a form compatible with the static image optimization pipeline.

#### Scenario: Author uploads a cover image
- **WHEN** an authorized author selects a supported image and supplies required alternative text
- **THEN** the CMS saves the media reference and the next build can generate optimized responsive variants

#### Scenario: Unsupported media is uploaded
- **WHEN** an author uploads a disallowed file type or a file exceeding the configured size limit
- **THEN** the CMS rejects the upload with an actionable explanation

### Requirement: Validated article model
The system SHALL validate every article against a typed content schema before a production build can succeed. The schema MUST require a title, description, publication date, publication status, category, tags, stable unique slug, and article body, and MUST support optional update date, cover image with alternative text, canonical URL, and SEO overrides.

#### Scenario: Valid article is accepted
- **WHEN** an author creates an article containing all required fields with valid values
- **THEN** the content build includes the article in the typed content collection

#### Scenario: Invalid article blocks publication
- **WHEN** an article is missing a required field, uses an invalid date, or duplicates an existing slug
- **THEN** the production build fails with a message identifying the invalid article and field

### Requirement: Draft-safe publishing
The system MUST exclude drafts, unpublished articles, and future-dated articles from all production pages, feeds, search indexes, structured data, and sitemaps while allowing authenticated preview during authoring.

#### Scenario: Draft remains private in production
- **WHEN** an article has its status set to `draft` and the production site is built
- **THEN** no public route or generated discovery artifact exposes that article

#### Scenario: Published article becomes public
- **WHEN** an article has its status set to `published` and its publication time is not in the future
- **THEN** the next successful production build publishes its article route and includes it in relevant discovery artifacts

### Requirement: Source-independent content access
The public application SHALL obtain normalized article data through a content access boundary and MUST NOT query a CMS or content database during a public page request.

#### Scenario: Static page delivery
- **WHEN** a reader requests a published article
- **THEN** the host serves prebuilt output without contacting the authoring system

### Requirement: Legal publishing safeguards
The system SHALL provide a reusable legal-information disclaimer and an authoring checklist covering anonymization and removal of unnecessary identifying information.

#### Scenario: Reader views legal content
- **WHEN** a reader opens a published legal article
- **THEN** the page presents a clear statement that the content is general information and personal experience rather than case-specific legal advice

#### Scenario: Author prepares publication
- **WHEN** an author follows the publication workflow
- **THEN** the workflow surfaces checks for names, contact details, case numbers, and other unnecessary identifying data
