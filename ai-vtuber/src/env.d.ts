/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_LLM_API_BASE?: string
  readonly VITE_LLM_MODEL?: string
  readonly VITE_VRM_MODEL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
