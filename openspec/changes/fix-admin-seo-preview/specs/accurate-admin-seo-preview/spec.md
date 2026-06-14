## ADDED Requirements

### Requirement: Admin SEO previews match public routes and branding

The Payload SEO generator SHALL use the localized site name and public route structure.

#### Scenario: Generating a post preview

- **WHEN** a post with slug `family-law` is edited in Traditional Chinese
- **THEN** the generated URL ends with `/zh-Hant/posts/family-law`

#### Scenario: Generating a fixed page preview

- **WHEN** a page with slug `about` is edited in English
- **THEN** the generated URL ends with `/en/about`

#### Scenario: Generating an SEO title

- **WHEN** a document title is present
- **THEN** the generated title combines the document title with the localized site name
- **AND** does not contain `Payload Website Template`

#### Scenario: Site settings cannot be read

- **WHEN** the localized site name cannot be loaded
- **THEN** the generator uses the locale-specific built-in site name
