## ADDED Requirements

### Requirement: Homepage hero title is managed through site settings

The system SHALL allow an authenticated administrator to maintain a localized homepage hero title in Site Settings.

#### Scenario: Localized title is configured

- **WHEN** the current locale has a non-empty `homepageHeroTitle`
- **THEN** the homepage displays that value as its primary heading

#### Scenario: Localized title is not configured

- **WHEN** the current locale has no `homepageHeroTitle`
- **THEN** the homepage displays the existing locale-specific default heading

#### Scenario: Tagline remains independent

- **WHEN** the homepage is rendered
- **THEN** the existing `tagline` remains the smaller introductory text
- **AND** `homepageHeroTitle` controls only the primary heading
