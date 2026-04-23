/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_PUBLISHABLE_KEY: string;
  readonly SUPABASE_SECRET_KEY: string;
  readonly DATABASE_URL: string;
  readonly AUTH_SECRET: string;
  readonly AUTH_TRUST_HOST: string;
  readonly AUTH_GOOGLE_ID: string;
  readonly AUTH_GOOGLE_SECRET: string;
  readonly AUTH_DISCORD_ID: string;
  readonly AUTH_DISCORD_SECRET: string;
  readonly ANTHROPIC_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
