## ADDED Requirements

### Requirement: Administrator-managed site identity
The administration interface SHALL allow an authorized author to edit the site title, site description, author name, author biography, author image, and default social image without modifying source code or redeploying.

#### Scenario: Author updates public profile information
- **WHEN** an authorized author saves valid site and author settings
- **THEN** public navigation, metadata, about content, and author components use the new values after cache invalidation

#### Scenario: Invalid settings are submitted
- **WHEN** required site or author text is blank or a media URL is invalid
- **THEN** the server rejects the update with actionable validation feedback and retains the previous settings

### Requirement: Article cover presentation
The system SHALL support an optional cover image, required alternative text when a cover exists, intrinsic media dimensions, and a configurable default image fallback instead of relying on a fixed decorative character.

#### Scenario: Article defines a cover
- **WHEN** a published article with valid cover metadata is displayed in a card or detail page
- **THEN** the cover is rendered with descriptive alternative text, stable dimensions, responsive sizing, and appropriate loading priority

#### Scenario: Article has no cover
- **WHEN** an article without a cover is displayed
- **THEN** the interface uses the configured default image or an accessible neutral fallback without broken media

### Requirement: Persistent accessible color theme
The public site SHALL provide light and dark themes, default to the operating-system preference, persist an explicit reader choice locally, and preserve all core content and controls with sufficient contrast.

#### Scenario: Reader has no saved theme
- **WHEN** a reader opens the site for the first time
- **THEN** the initial render follows the reader's `prefers-color-scheme` value without a visible incorrect-theme flash

#### Scenario: Reader changes theme
- **WHEN** the reader activates the theme control
- **THEN** the page updates immediately, exposes the new state accessibly, and uses the same preference on later pages

#### Scenario: JavaScript is unavailable
- **WHEN** a public page is loaded without client-side JavaScript
- **THEN** the operating-system theme still applies through CSS and all content remains readable
