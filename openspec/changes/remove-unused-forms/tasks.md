## 1. Regression Coverage

- [x] 1.1 Add configuration tests proving the form collections and page form block are currently registered
- [x] 1.2 Run the targeted test and confirm it fails against the existing form-enabled configuration

## 2. Remove Form Functionality

- [x] 2.1 Remove Form Builder from Payload plugins and page block configuration
- [x] 2.2 Remove the frontend form renderer, form components, and contact-form seed integration
- [x] 2.3 Remove the form-builder and react-hook-form package dependencies

## 3. Generated Artifacts and Verification

- [x] 3.1 Regenerate Payload types and admin import map
- [x] 3.2 Run targeted and full tests, typecheck, lint, production build, and OpenSpec validation
