/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_URL?: string;
  readonly PUBLIC_SITE_NAME?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  readonly PUBLIC_PREVIEW?: string;
  readonly KEYSTATIC_CLOUD_PROJECT?: string;
  readonly PUBLIC_UMAMI_WEBSITE_ID?: string;
  readonly PUBLIC_UMAMI_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
