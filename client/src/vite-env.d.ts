/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the API base URL (e.g. deployed on a different host). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
