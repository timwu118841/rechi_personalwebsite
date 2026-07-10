## ADDED Requirements

### Requirement: Configurable analytics loading
The system SHALL load analytics only in production when a valid provider configuration is present and MUST render the public site without errors when analytics is disabled or blocked.

#### Scenario: Analytics is not configured
- **WHEN** the site runs without a production analytics site identifier
- **THEN** no analytics script or tracking request is emitted

#### Scenario: Tracking script is blocked
- **WHEN** a browser or content blocker prevents the analytics provider from loading
- **THEN** navigation, search, and article reading continue without visible errors

### Requirement: Privacy-minimized measurement
The analytics integration MUST limit its payload to approved non-sensitive fields and MUST NOT intentionally transmit article body text, raw search queries, names, email addresses, case identifiers, or other legal-case personal data.

#### Scenario: Article engagement is recorded
- **WHEN** an eligible reader reaches an approved reading-progress threshold
- **THEN** the system records an event containing only the article identifier, threshold, and approved page context

#### Scenario: Reader uses site search
- **WHEN** a reader performs a site search
- **THEN** analytics may record that a search occurred and the result count but does not transmit the raw query

### Requirement: Consent-aware providers
If the selected analytics provider uses non-essential cookies or cross-site identifiers, the system MUST withhold that provider until the reader grants valid consent and MUST provide a way to withdraw consent.

#### Scenario: Consent is required but absent
- **WHEN** the configured provider requires consent and the reader has not granted it
- **THEN** no provider script, cookie, or tracking request is activated

### Requirement: Search performance monitoring
The system SHALL support configurable site ownership verification and sitemap discovery for search-engine webmaster tools without hard-coding secret or environment-specific verification values.

#### Scenario: Ownership verification is configured
- **WHEN** an authorized verification token is supplied for production
- **THEN** the site emits the required verification value through the supported configuration path

### Requirement: Non-blocking analytics
Analytics MUST NOT block first content rendering and SHALL remain within the defined page JavaScript and performance budgets.

#### Scenario: Analytics is enabled
- **WHEN** a production article page loads with analytics configured
- **THEN** the article content renders independently of analytics initialization and automated performance checks remain within budget

