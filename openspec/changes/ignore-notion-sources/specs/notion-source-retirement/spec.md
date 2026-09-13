## ADDED Requirements

### Requirement: Source retirement
The system SHALL let an authorized administrator retire a synced Notion source without deleting its revisions, working copy, publication candidates, or published article, and SHALL record the retirement time and actor.

#### Scenario: Administrator retires a source
- **WHEN** an authorized administrator retires a synced source
- **THEN** the source is marked as ignored with a timestamp and the administrator identity is written to the content audit log

#### Scenario: Retired source keeps its history
- **WHEN** a source is retired
- **THEN** its revisions, working copy, and any published article remain stored and publicly unchanged

### Requirement: Sync exclusion
The system MUST exclude retired sources from discovery synchronization and MUST NOT write new revisions, working copies, or job records for them while they stay retired.

#### Scenario: Database synchronization runs while a source is retired
- **WHEN** a data source synchronization is planned or a queued source job runs after retirement
- **THEN** the retired source is skipped and neither a new revision nor a working copy is written for it

#### Scenario: Queued work exists at retirement time
- **WHEN** a source with queued content jobs or not-yet-live publication candidates is retired
- **THEN** those queued jobs and open candidates are cancelled and no further processing occurs for them

### Requirement: Publish boundary for retired sources
The system MUST reject attempts to create or publish a publication candidate for a retired source until it is restored.

#### Scenario: Candidate creation for a retired source
- **WHEN** a candidate is requested for a working copy whose source is retired
- **THEN** the request is rejected with an actionable error and no candidate row is created

### Requirement: Restoration
The system SHALL let an authorized administrator restore a retired source, after which it participates in synchronization again.

#### Scenario: Administrator restores a source
- **WHEN** an authorized administrator restores a retired source
- **THEN** the retirement marker is removed, the restoration is audited, and the source can be synchronized again

### Requirement: Batch retirement
The system SHALL support retiring or restoring up to 200 sources in a single authorized operation and MUST report which sources were changed.

#### Scenario: Administrator retires several sources at once
- **WHEN** an authorized administrator submits several source identifiers
- **THEN** each existing source is retired in one transaction and the updated sources are returned

#### Scenario: Request contains an unknown identifier
- **WHEN** the submitted identifiers include one that does not exist
- **THEN** the whole operation is rejected without changing any source
