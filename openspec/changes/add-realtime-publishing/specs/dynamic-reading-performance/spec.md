## ADDED Requirements

### Requirement: On-demand indexable rendering
Every public content route SHALL render complete semantic HTML from the current published content source on the server so that readers and crawlers do not require client-side JavaScript to read or index it.

#### Scenario: Crawler requests a newly published article
- **WHEN** a crawler requests the canonical URL of an eligible article added after deployment
- **THEN** the initial response contains the article content, metadata, structured data, and canonical URL

### Requirement: Edge-cached public responses
The system SHALL cache eligible public HTML and discovery responses on the Vercel CDN with content-specific tags and stale-while-revalidate behavior, while administration and authenticated API responses MUST NOT be publicly cached.

#### Scenario: Reader opens a cached article
- **WHEN** an unchanged published article is requested after a cache entry exists
- **THEN** Vercel can serve the complete page from the edge without a database query or function render

#### Scenario: Administration endpoint returns data
- **WHEN** an authenticated administration route or API is requested
- **THEN** its response is marked private or no-store and cannot enter the shared CDN cache

### Requirement: Content-aware cache invalidation
Successful article, taxonomy, media-reference, or site-setting mutations SHALL invalidate every affected public cache tag and path without initiating an application redeployment.

#### Scenario: Published article changes
- **WHEN** an authorized author publishes, edits, renames, or unpublishes an article
- **THEN** its detail page and affected lists, search, feeds, sitemaps, categories, and tags are marked stale for revalidation

#### Scenario: Site identity changes
- **WHEN** an authorized author saves site presentation settings
- **THEN** all public pages that use those settings are marked stale for revalidation

### Requirement: Server-side pagination
The article index SHALL use stable server-side pagination with nine articles per page, preserve reverse chronological ordering, expose accessible previous and next navigation, and emit unambiguous canonical URLs.

#### Scenario: Reader opens a valid later page
- **WHEN** a reader requests an existing `page` value greater than one
- **THEN** the response contains only that page's articles, the total-page context, navigation links, and a canonical URL containing the page number

#### Scenario: Reader opens page one explicitly
- **WHEN** a reader requests `?page=1`
- **THEN** the canonical URL points to the article index without the redundant parameter

#### Scenario: Reader requests an invalid page
- **WHEN** the `page` value is non-numeric, negative, or beyond the available range
- **THEN** the system returns a safe not-found or normalized response without leaking private content

### Requirement: Preserved public performance budget
Representative article and list pages SHALL keep non-admin initial client JavaScript at or below 75 KB gzip, avoid hydrating article body content, prevent avoidable image layout shift, and retain the established Lighthouse quality thresholds.

#### Scenario: Production output is validated
- **WHEN** automated quality checks inspect representative public routes
- **THEN** they confirm the JavaScript budget, semantic content, image dimensions, cache directives, and configured Lighthouse thresholds
