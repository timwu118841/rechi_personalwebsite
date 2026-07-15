/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_URL?: string;
  readonly PUBLIC_SITE_NAME?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  readonly PUBLIC_PREVIEW?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly PUBLIC_ADMIN_PASSWORD_LOGIN?: string;
  readonly SUPABASE_SECRET_KEY?: string;
  readonly CRON_SECRET?: string;
  readonly NOTION_EDITORIAL_ENABLED?: string;
  readonly NOTION_TOKEN?: string;
  readonly NOTION_ROOT_PAGE_ID?: string;
  readonly NOTION_VERSION?: string;
  readonly CONTENT_PUBLIC_READ_MODE?: string;
  readonly NOTION_PUBLICATION_MODE?: string;
  readonly ALLOW_FIXTURE_CONTENT?: string;
  readonly PUBLIC_UMAMI_WEBSITE_ID?: string;
  readonly PUBLIC_UMAMI_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
