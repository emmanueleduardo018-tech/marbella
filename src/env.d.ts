/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly GOOGLE_DRIVE_API_KEY: string;
  readonly GOOGLE_DRIVE_ROOT_FOLDER_ID: string;
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
  readonly CLOUDINARY_ROOT_FOLDER: string;
  readonly GTM_CONTAINER_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
