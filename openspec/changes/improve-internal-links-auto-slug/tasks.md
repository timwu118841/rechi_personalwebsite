## 1. Regression Tests

- [x] 1.1 Add failing rendering tests for locale-aware internal article and page links
- [x] 1.2 Add failing configuration tests for Payload's editable LinkFeature and localized automatic post slug

## 2. Internal Link Repair

- [x] 2.1 Restore Payload's built-in internal link fields in the shared Lexical editor
- [x] 2.2 Add a locale-aware internal href resolver and connect the article page locale to RichText

## 3. Stable Automatic Slugs

- [x] 3.1 Replace the manual Posts slug field with a localized, translated Payload slugField
- [x] 3.2 Regenerate Payload types and admin import map
- [x] 3.3 Generate a PostgreSQL migration without rewriting existing slugs

## 4. Verification

- [x] 4.1 Run targeted and full integration tests, typecheck, lint, and production build
- [x] 4.2 Run strict OpenSpec validation and inspect the final diff
