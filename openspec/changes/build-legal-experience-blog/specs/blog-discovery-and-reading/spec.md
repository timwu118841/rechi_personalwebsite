## ADDED Requirements

### Requirement: Content-first public routes
The system SHALL provide a home page, article index, article detail pages, category pages, tag pages, search page, about page, and not-found page using consistent navigation and semantic landmarks.

#### Scenario: Reader discovers recent content
- **WHEN** a reader visits the home page or article index
- **THEN** the page presents published articles in reverse chronological order with title, description, publication date, category, tags, and reading time

#### Scenario: Reader browses a taxonomy
- **WHEN** a reader opens a category or tag route
- **THEN** the page lists only published articles assigned to that taxonomy and provides a meaningful empty state when none exist

### Requirement: Focused article reading
The article page SHALL prioritize legible long-form reading on mobile and desktop and MUST display the title, description, author, publication date, optional update date, reading time, category, tags, article body, legal disclaimer, and share actions.

#### Scenario: Long-form article is readable
- **WHEN** a reader opens an article on a supported viewport
- **THEN** the body uses a constrained line length, responsive typography, sufficient spacing, visible focus styles, and semantic heading order without horizontal page scrolling

#### Scenario: Article has been updated
- **WHEN** an article defines an update date later than its publication date
- **THEN** the page displays both dates with unambiguous labels

### Requirement: Static full-text search
The system SHALL provide keyboard-accessible full-text search over published article titles, descriptions, headings, categories, tags, and body text using a build-generated index.

#### Scenario: Search returns relevant articles
- **WHEN** a reader submits a query matching indexed published content
- **THEN** the interface displays ranked article results with title, context excerpt, and destination link

#### Scenario: Search has no result
- **WHEN** a query matches no published content
- **THEN** the interface shows a no-result message and offers links to the article index and available categories

#### Scenario: Private content is not searchable
- **WHEN** the production search index is generated
- **THEN** drafts and future-dated articles are absent from the index

### Requirement: Resilient responsive navigation
The system MUST allow readers to reach primary sections and search with keyboard, touch, and pointer input, and core content discovery MUST remain usable when client-side JavaScript is unavailable.

#### Scenario: JavaScript is unavailable
- **WHEN** a reader opens a public page without client-side JavaScript
- **THEN** navigation, article links, categories, tags, and the complete article body remain accessible

