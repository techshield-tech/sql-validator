# SQL Validator

Validate SQL syntax across multiple dialects, inspect the tables and columns
a query references, and catch common mistakes with built-in lint checks —
fast, free, and 100% client-side. Your SQL is never sent over the network;
everything runs in your browser.

**Live:** https://techshield-tech.github.io/sql-validator/

Part of [MMOALL Developer Tools](https://mmoall.com/tools).

## Features

- Syntax validation powered by [`node-sql-parser`](https://github.com/taozhi8833998/node-sql-parser),
  with a dialect selector covering every database it supports: MySQL,
  MariaDB, PostgreSQL, SQLite, TransactSQL (SQL Server), BigQuery, Snowflake,
  Redshift, Athena, Hive, DB2, FlinkSQL, Trino, and Noql.
- Multiple statements in one input, separated by semicolons.
- Clear syntax-error messages with line/column position when the parser
  provides one — no raw stack traces.
- On success, a results summary: statement count, each statement's type
  (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, …), and every table and
  column the input references (via the parser's `tableList`/`columnList`).
- Lint findings, shown separately for each statement, with three severity
  levels (error / warning / info):
  - `SELECT *` usage
  - `DELETE`/`UPDATE` without a `WHERE` clause
  - `SELECT` missing a `LIMIT` clause (informational)
  - Implicit cross join (comma-style joins in `FROM`, e.g. `FROM a, b`)
  - `= NULL` comparisons (should be `IS NULL`)
  - Leading-wildcard `LIKE` patterns (e.g. `LIKE '%foo'`), which can't use a
    standard index
- Load a representative multi-statement sample that triggers every lint rule.
- `node-sql-parser` is loaded lazily via a dynamic `import()`, so it never
  blocks first paint.
- Responsive down to 360px viewport width.

## Embedding

This tool can be embedded in an iframe, e.g. on mmoall.com. In embed mode it
renders only the tool itself (no header/footer) on a transparent background.

```html
<iframe
  id="sql-validator"
  src="https://techshield-tech.github.io/sql-validator/?embed=1&theme=dark"
  style="width: 100%; border: 0;"
  title="SQL Validator"
></iframe>

<script>
  const iframe = document.getElementById('sql-validator');

  // Resize the iframe to fit its content.
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'mmoall-tool:height' && data.slug === 'sql-validator') {
      iframe.style.height = `${data.height}px`;
    }
    if (data && data.type === 'mmoall-tool:ready' && data.slug === 'sql-validator') {
      // The tool has mounted and is ready.
    }
  });

  // Push a theme change into the iframe (only accepted from an allowed origin).
  iframe.contentWindow.postMessage({ type: 'mmoall-tool:theme', theme: 'dark' }, '*');
</script>
```

### Contract

- `?embed=1` in the URL renders only the tool (no chrome), transparent
  background.
- `?theme=light` / `?theme=dark` sets the initial theme; otherwise it follows
  `prefers-color-scheme`.
- The page listens for `window.postMessage({type:'mmoall-tool:theme', theme})`
  from the parent frame to change theme at runtime. Only messages whose
  `event.origin` is `https://mmoall.com`, `https://www.mmoall.com`, or
  `http://localhost:3000` are accepted.
- On mount (embed mode only), the page posts
  `{type:'mmoall-tool:ready', slug:'sql-validator'}` to `window.parent`.
- Whenever its rendered height changes (embed mode only), the page posts
  `{type:'mmoall-tool:height', slug:'sql-validator', height}` to
  `window.parent`.

## Local development

```bash
bun install
bun dev
```

Build for production:

```bash
bun run build
```

Deployment to GitHub Pages happens automatically via
`.github/workflows/deploy.yml` on every push to `main`.

## License

MIT — see [LICENSE](./LICENSE).
