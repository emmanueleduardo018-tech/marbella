/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly GOOGLE_DRIVE_API_KEY: string;
  readonly GOOGLE_DRIVE_ROOT_FOLDER_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}