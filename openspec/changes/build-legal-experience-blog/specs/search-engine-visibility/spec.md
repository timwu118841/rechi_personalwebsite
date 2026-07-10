## ADDED Requirements

### Requirement: Unique indexable metadata
Every indexable page SHALL emit a unique descriptive title, meta description, absolute canonical URL, Open Graph metadata, and language declaration derived from validated site and page data.

#### Scenario: Published article metadata is rendered
- **WHEN** a crawler requests a published article page
- **THEN** the initial HTML contains the article-specific title, description, canonical URL, social metadata, and `zh-Hant-TW` language context without requiring JavaScript

#### Scenario: Canonical site URL is missing
- **WHEN** a production build lacks a valid absolute site URL
- **THEN** the build fails rather than emitting invalid canonical or social URLs

### Requirement: Structured article data
Published article pages MUST include valid JSON-LD representing the article, author, publication and update dates, images when available, main page entity, and breadcrumbs without contradicting visible page content.

#### Scenario: Search engine parses an article
- **WHEN** a published article contains all required structured-data fields
- **THEN** its initial HTML contains syntactically valid article and breadcrumb JSON-LD matching the visible content

### Requirement: Crawl discovery artifacts
The production build SHALL generate sitemap, robots, and RSS artifacts containing absolute URLs for eligible published content.

#### Scenario: Production discovery files are built
- **WHEN** a production build succeeds
- **THEN** `sitemap.xml`, `robots.txt`, and an RSS feed are available and reference the configured canonical origin

#### Scenario: Draft is excluded from discovery
- **WHEN** discovery artifacts are generated
- **THEN** drafts, future-dated articles, preview pages, error pages, and internal search result pages are absent from the sitemap and RSS feed

### Requirement: Explicit indexing controls
Preview, error, and non-public pages MUST emit noindex controls, while published canonical content SHALL remain indexable unless explicitly configured otherwise.

#### Scenario: Preview deployment is crawled
- **WHEN** a crawler requests a page from a preview environment
- **THEN** the response communicates that the page must not be indexed

### Requirement: SEO validation
The delivery pipeline MUST detect broken internal links, missing required metadata, duplicate canonical URLs, invalid structured data syntax, and accidental indexing of private content before production deployment.

#### Scenario: SEO regression is introduced
- **WHEN** an automated check finds a required SEO contract violation
- **THEN** the production deployment is blocked with actionable failure output

