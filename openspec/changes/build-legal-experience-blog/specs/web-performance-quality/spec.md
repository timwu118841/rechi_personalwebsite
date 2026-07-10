## ADDED Requirements

### Requirement: Static-first delivery
All public, indexable routes MUST be generated as static HTML and MUST NOT require a runtime CMS or database request to render their primary content.

#### Scenario: Published article is requested
- **WHEN** a reader requests a published article from the production origin
- **THEN** the CDN can satisfy the request using a prebuilt HTML asset and its static dependencies

### Requirement: JavaScript budget
The initial client-side JavaScript for a representative article route MUST NOT exceed 75 KB gzip, and non-interactive article body content MUST NOT be hydrated.

#### Scenario: Production bundle is measured
- **WHEN** the representative article page is built for production
- **THEN** automated bundle analysis reports initial JavaScript at or below 75 KB gzip

### Requirement: Optimized media and fonts
The system SHALL serve responsive images with intrinsic dimensions and efficient formats, lazy-load below-the-fold media, prioritize the primary above-the-fold image when present, and avoid render-blocking remote fonts.

#### Scenario: Article contains a cover and inline images
- **WHEN** the article page is built
- **THEN** generated image markup includes appropriate dimensions, responsive sources, meaningful alternative text, and loading priority based on visual position

### Requirement: Core Web Vitals targets
The production site SHALL target a 75th-percentile Largest Contentful Paint of at most 2.5 seconds, Interaction to Next Paint of at most 200 milliseconds, and Cumulative Layout Shift of at most 0.1 on mobile and desktop traffic.

#### Scenario: Real-user performance data is available
- **WHEN** sufficient privacy-compliant field data has been collected
- **THEN** the site reports each Core Web Vital by page type and identifies any target regression

### Requirement: Automated quality gates
Representative production pages MUST achieve Lighthouse scores of at least 95 for Performance, Accessibility, and Best Practices and 100 for SEO under the agreed CI profile, with no critical automated accessibility violations.

#### Scenario: A quality score regresses
- **WHEN** a representative page falls below a required threshold or has a critical accessibility violation
- **THEN** the release check fails and reports the affected route and audit

### Requirement: Accessible content experience
The site MUST support semantic landmarks, keyboard navigation, visible focus, sufficient color contrast, descriptive link and image text, reduced-motion preferences, and page zoom without loss of core content or function.

#### Scenario: Keyboard-only reader navigates the site
- **WHEN** a reader uses only the keyboard
- **THEN** all interactive controls are reachable in a logical order and the current focus is visually apparent

