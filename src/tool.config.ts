// Per-tool metadata. This is the ONE file (together with `src/tool/`,
// `index.html`'s fallback <title>, and this repo's README) that changes
// when this template is copied to a new tool repo.

// Imports from '@mmoall/tool-kit/config' (a plain-JS-backed subpath), not
// the main '@mmoall/tool-kit' barrel — this file is also reachable from
// vite.config.ts's config-load chain, which cannot load the main barrel's
// .ts source from inside node_modules. See '@mmoall/tool-kit/config's
// source comment for why.
import { defineToolConfig } from '@mmoall/tool-kit/config';

export const toolConfig = defineToolConfig({
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
});
