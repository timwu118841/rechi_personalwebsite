## ADDED Requirements

### Requirement: Public post surfaces render configured cover images

The public website SHALL render a post's configured `heroImage` on the post detail page without automatically changing homepage or listing cards.

#### Scenario: Post has a populated cover image

- **WHEN** a published post contains a populated `heroImage`
- **THEN** its detail page displays the image with the media alternative text between the article header and body
- **AND** its homepage and listing cards remain text-only

#### Scenario: Post has no cover image

- **WHEN** a published post has no `heroImage`
- **THEN** the detail page retains its text layout without an empty image container

#### Scenario: Homepage imagery is independently controlled

- **WHEN** a post has a configured article cover image
- **THEN** that image is not automatically reused as homepage imagery
