## 1. Configuration and Regression Coverage

- [x] 1.1 Add failing tests for complete, absent, and partial R2 environment configuration
- [x] 1.2 Add failing tests for public media URL generation and Next.js remote image patterns

## 2. R2 Storage Integration

- [x] 2.1 Add the Payload S3 storage adapter dependency
- [x] 2.2 Implement validated R2 configuration and public URL helpers
- [x] 2.3 Configure Payload media uploads to use R2 when enabled
- [x] 2.4 Configure Next.js Image to accept the R2 public host

## 3. Deployment Documentation

- [x] 3.1 Update environment declarations and `.env.example` for R2
- [x] 3.2 Document Cloudflare and Vercel setup steps for `media.tiwu.com`

## 4. Verification

- [x] 4.1 Run integration tests, typecheck, lint, production build, and strict OpenSpec validation
