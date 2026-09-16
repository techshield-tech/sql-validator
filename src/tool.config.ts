// Per-tool metadata. This is the ONE file (together with the `base` in
// vite.config.ts, index.html's <title>/meta tags, README.md, and everything
// under src/tool/) that changes when this template is copied to a sibling
// tool repo.

export type ToolCategory = 'JSON' | 'JWT' | 'SQL' | 'Docker' | 'Git' | 'Web';

export interface ToolConfig {
  /** Unique identifier used in embed postMessage payloads and URLs. */
  slug: string;
  /** Display name shown in the header. */
  name: string;
  /** Short description used for meta tags and listings. */
  description: string;
  /** One of the shared MMOALL tool categories. */
  category: ToolCategory;
  /** Keywords for search/SEO purposes. */
  keywords: string[];
}

export const toolConfig: ToolConfig = {
  slug: 'sql-validator',
  name: 'SQL Validator',
  description:
    'Validate SQL syntax across multiple dialects, inspect referenced tables and columns, and catch common query mistakes with built-in lint checks — fast, free, and 100% client-side.',
  category: 'SQL',
  keywords: [
    'sql validator',
    'sql syntax checker',
    'sql linter',
    'sql parser online',
    'sql dialect checker',
    'validate sql query',
    'online sql tool',
  ],
};
