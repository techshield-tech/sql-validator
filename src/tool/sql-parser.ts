// Pure, framework-free wrapper around `node-sql-parser`. Tool-specific.
//
// `node-sql-parser` is a CommonJS/UMD package (no ESM build), so it is
// loaded lazily via dynamic `import()` — this keeps it out of the initial
// bundle entirely and off the critical path for first paint. See
// `loadParser()` below.
//
// The exact API surface used here (`parse`, `astify`'s return shape, the
// `database` option, the `tableList`/`columnList` string encoding, and the
// pegjs `SyntaxError` shape) was verified against the installed version
// (node-sql-parser@5.4.0) by inspecting `node_modules/node-sql-parser`'s
// `types.d.ts`, `lib/util.js`, `lib/parser.js`, `lib/parser.all.js`, and by
// running sample parses — not from memory, since the README's documented
// AST shape (e.g. `columns: "*"`) does not always match this version's
// actual runtime output (e.g. `columns` is always an array here).

import type { Option } from 'node-sql-parser';

/** A single parsed SQL statement's AST node. Loosely typed on purpose: the
 * shape varies by statement type and dialect, and downstream code
 * (sql-lint.ts) pattern-matches on it defensively rather than assuming a
 * rigid shape. */
export type Statement = Record<string, unknown>;

export interface DialectOption {
  value: string;
  label: string;
}

// Exact dialect keys accepted by installed node-sql-parser@5.4.0's
// `database` option (matched case-insensitively against
// `lib/parser.all.js`'s dialect map: athena, bigquery, db2, flinksql, hive,
// mariadb, mysql, noql, postgresql, redshift, snowflake, sqlite,
// transactsql, trino). The `value`s below are just a readable casing of
// those same keys — matching is case-insensitive so any casing works.
export const DIALECTS: DialectOption[] = [
  { value: 'MySQL', label: 'MySQL' },
  { value: 'MariaDB', label: 'MariaDB' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'Sqlite', label: 'SQLite' },
  { value: 'TransactSQL', label: 'TransactSQL (SQL Server)' },
  { value: 'BigQuery', label: 'BigQuery' },
  { value: 'Snowflake', label: 'Snowflake (alpha)' },
  { value: 'Redshift', label: 'Redshift' },
  { value: 'Athena', label: 'Athena' },
  { value: 'Hive', label: 'Hive' },
  { value: 'DB2', label: 'DB2' },
  { value: 'FlinkSQL', label: 'FlinkSQL' },
  { value: 'Trino', label: 'Trino' },
  { value: 'Noql', label: 'Noql' },
];

export const DEFAULT_DIALECT = 'MySQL';

interface ParseReturn {
  tableList: string[];
  columnList: string[];
  ast: Statement | Statement[];
}

interface ParserLike {
  parse(sql: string, opt?: Option): ParseReturn;
}

// `node-sql-parser`'s UMD bundle assigns its exports dynamically
// (`for (const k in exports) target[k] = exports[k]`), which static
// CJS-named-export detection (cjs-module-lexer, used by both Node's ESM
// loader and bundlers like Vite/esbuild) cannot see. A named
// `import { Parser } from 'node-sql-parser'` is therefore unreliable; the
// default export (the whole CJS `module.exports` object) always works, so
// we read `Parser` off of that instead — checked defensively for both
// shapes in case a future bundler configuration changes the interop.
interface NodeSqlParserModule {
  Parser?: new () => ParserLike;
  default?: { Parser?: new () => ParserLike };
}

let parserPromise: Promise<ParserLike> | null = null;

function loadParser(): Promise<ParserLike> {
  if (!parserPromise) {
    parserPromise = import('node-sql-parser').then((mod) => {
      const namespace = mod as unknown as NodeSqlParserModule;
      const ParserCtor = namespace.default?.Parser ?? namespace.Parser;
      if (!ParserCtor) {
        throw new Error('node-sql-parser: could not find the Parser export');
      }
      return new ParserCtor();
    });
  }
  return parserPromise;
}

export interface SqlParseError {
  message: string;
  /** 1-based line number, or null if the parser didn't report one. */
  line: number | null;
  /** 1-based column number, or null if the parser didn't report one. */
  column: number | null;
}

// The pegjs-generated grammars used internally throw a `SyntaxError`-like
// object with `message`, `expected`, `found`, and a `location` range
// (`{start: {line, column, offset}, end: {...}}`) — confirmed by triggering
// a real parse error above. It is not a `SyntaxError` instance from the
// global namespace, so we duck-type it instead of using `instanceof`.
interface PegLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

interface PegSyntaxError {
  message: string;
  location?: PegLocation;
}

function isPegSyntaxError(error: unknown): error is PegSyntaxError {
  return typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string';
}

export function describeSqlError(error: unknown): SqlParseError {
  if (isPegSyntaxError(error)) {
    return {
      message: error.message,
      line: error.location ? error.location.start.line : null,
      column: error.location ? error.location.start.column : null,
    };
  }
  return {
    message: error instanceof Error ? error.message : String(error),
    line: null,
    column: null,
  };
}

/** Formats a `SqlParseError` into a single human-readable line. */
export function formatSqlError(info: SqlParseError): string {
  if (info.line !== null && info.column !== null) {
    return `${info.message} (line ${info.line}, column ${info.column})`;
  }
  return info.message;
}

export interface ParseSuccess {
  ok: true;
  statements: Statement[];
  tableList: string[];
  columnList: string[];
}

export interface ParseFailure {
  ok: false;
  error: SqlParseError;
}

export type ParseResult = ParseSuccess | ParseFailure;

function isStatementNode(value: unknown): value is Statement {
  // A stray statement boundary (e.g. input ending in `;;`) parses to an
  // empty array `[]` rather than a statement object — filter those out.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses `sql` (one or more `;`-separated statements) under `dialect`. */
export async function parseSql(sql: string, dialect: string): Promise<ParseResult> {
  const parser = await loadParser();
  try {
    const result = parser.parse(sql, {
      database: dialect,
      // Keep offsets/line numbers aligned with the exact text the user
      // typed (no implicit trimming), and request `loc` info on every node.
      trimQuery: false,
      parseOptions: { includeLocations: true },
    });
    const rawAst = result.ast;
    const statements = (Array.isArray(rawAst) ? rawAst : [rawAst]).filter(isStatementNode);
    return {
      ok: true,
      statements,
      tableList: result.tableList ?? [],
      columnList: result.columnList ?? [],
    };
  } catch (error) {
    return { ok: false, error: describeSqlError(error) };
  }
}

/** Human-readable statement type, e.g. "SELECT", "CREATE TABLE", "DROP INDEX". */
export function statementLabel(stmt: Statement): string {
  const type = typeof stmt.type === 'string' ? stmt.type : 'unknown';
  const keyword = typeof stmt.keyword === 'string' ? stmt.keyword : '';
  const label = keyword && keyword !== type ? `${type} ${keyword}` : type;
  return label.toUpperCase();
}

// node-sql-parser encodes each `tableList`/`columnList` entry as
// `"<statementType>::<qualifier-or-null>::<name>"` (e.g.
// `"select::null::orders"`, `"select::orders::id"`), and marks a star
// column as the literal name `"(.*)"` — all confirmed by inspecting real
// `parser.parse()` output above. This turns that into a readable
// `qualifier.name` (or just `name`), normalizes `(.*)` back to `*`,
// deduplicates, and sorts for stable display.
export function formatReferenceList(entries: string[]): string[] {
  const formatted = new Set<string>();
  for (const entry of entries) {
    const parts = entry.split('::');
    const rest = parts.slice(1);
    if (rest.length === 0) {
      formatted.add(entry);
      continue;
    }
    const rawName = rest[rest.length - 1];
    const name = rawName === '(.*)' ? '*' : rawName;
    const qualifiers = rest.slice(0, -1).filter((part) => part !== '' && part !== 'null');
    formatted.add(qualifiers.length > 0 ? `${qualifiers.join('.')}.${name}` : name);
  }
  return Array.from(formatted).sort((a, b) => a.localeCompare(b));
}

/**
 * Splits `sql` into individual statement source strings on top-level `;`
 * characters — i.e. semicolons that are not inside a quoted string,
 * backtick/double-quoted identifier, or a `--`/`/* * /` comment.
 *
 * This is intentionally independent of the parser: a statement's own AST
 * node does not reliably carry a `loc` range for every statement in a
 * multi-statement parse (only the first one did in testing), so slicing by
 * the parser's own locations isn't dependable. This hand-rolled split is
 * used to recover readable per-statement source text for display and for
 * the lint rules' text-based fallback checks.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: '"' | "'" | '`' | null = null;
  let lineComment = false;
  let blockComment = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (lineComment) {
      current += ch;
      if (ch === '\n') lineComment = false;
      i += 1;
      continue;
    }
    if (blockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 2;
        blockComment = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === '\\' && quote !== '`' && next !== '') {
        // Escaped character inside a string literal — consume verbatim so
        // e.g. `'it\'s'` doesn't end the string early.
        current += next;
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      i += 1;
      continue;
    }
    if (ch === '-' && next === '-') {
      lineComment = true;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === ';') {
      statements.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim() !== '') {
    statements.push(current);
  }

  return statements.map((statement) => statement.trim()).filter((statement) => statement !== '');
}
