/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_CLIENT_SECRET?: string;
  readonly VITE_DISCORD_BOT_TOKEN?: string;
  readonly VITE_DISCORD_CLIENT_ID?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
