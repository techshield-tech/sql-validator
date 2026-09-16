// Pure, framework-free lint heuristics for a single parsed SQL statement.
// Tool-specific. No dependency on node-sql-parser's own types: the AST is
// treated as loosely-typed data that each rule pattern-matches on
// defensively, since node-sql-parser@5.4.0's actual runtime AST shape (as
// verified by running real parses — see sql-parser.ts) doesn't always match
// its own published .d.ts. Each rule operates on the AST where the shape is
// reliably exposed, and falls back to a text/regex heuristic only where
// noted.

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  ruleId: string;
  severity: LintSeverity;
  message: string;
}

type Node = Record<string, unknown>;

function isObject(value: unknown): value is Node {
  return typeof value === 'object' && value !== null;
}

/** Depth-first walk over every plain-object node reachable from `root`
 * (arrays are traversed but not visited themselves). Guards against cycles
 * defensively, though the parser's AST is a tree in practice. */
function walk(root: unknown, visit: (node: Node) => void, seen: Set<unknown> = new Set()): void {
  if (Array.isArray(root)) {
    for (const item of root) walk(item, visit, seen);
    return;
  }
  if (!isObject(root)) return;
  if (seen.has(root)) return;
  seen.add(root);
  visit(root);
  for (const value of Object.values(root)) {
    walk(value, visit, seen);
  }
}

function nodeType(node: Node): string | null {
  return typeof node.type === 'string' ? node.type : null;
}

function isNullLiteral(value: unknown): boolean {
  return isObject(value) && nodeType(value) === 'null';
}

/** Extracts the literal string value of a `..._string` value node, if any. */
function stringLiteralValue(value: unknown): string | null {
  if (!isObject(value)) return null;
  const type = nodeType(value);
  if (!type || !/string$/i.test(type)) return null;
  return typeof value.value === 'string' ? value.value : null;
}

// --- Rule: SELECT * ---------------------------------------------------

function columnIsStar(column: unknown): boolean {
  if (!isObject(column)) return false;
  const expr = column.expr;
  if (!isObject(expr)) return false;
  if (expr.type === 'star') return true;
  if (expr.column === '*') return true;
  if (isObject(expr.column) && expr.column.value === '*') return true;
  return false;
}

function checkSelectStar(stmt: Node, rawText: string): LintIssue[] {
  if (stmt.type !== 'select') return [];
  const columns = stmt.columns;
  let usesStar = columns === '*';
  if (!usesStar && Array.isArray(columns)) {
    usesStar = columns.some(columnIsStar);
  }
  if (!usesStar) {
    // The AST didn't cleanly expose a star column (unexpected shape for
    // this dialect/version) — fall back to a text heuristic for
    // `SELECT *` / `SELECT DISTINCT *` / `alias.*`.
    usesStar = /\bselect\s+(distinct\s+)?\*/i.test(rawText) || /,\s*[\w`".]+\.\*/i.test(rawText);
  }
  if (!usesStar) return [];
  return [
    {
      ruleId: 'select-star',
      severity: 'warning',
      message: 'Avoid SELECT * — list the exact columns you need instead.',
    },
  ];
}

// --- Rule: DELETE / UPDATE without WHERE --------------------------------

function checkMissingWhere(stmt: Node): LintIssue[] {
  if (stmt.type !== 'delete' && stmt.type !== 'update') return [];
  if (stmt.where != null) return [];
  const kind = stmt.type === 'delete' ? 'DELETE' : 'UPDATE';
  return [
    {
      ruleId: 'missing-where',
      severity: 'error',
      message: `${kind} has no WHERE clause — it will affect every row in the table.`,
    },
  ];
}

// --- Rule: SELECT missing LIMIT (informational) -------------------------

function checkMissingLimit(stmt: Node): LintIssue[] {
  if (stmt.type !== 'select') return [];
  if (stmt.limit != null) return [];
  return [
    {
      ruleId: 'missing-limit',
      severity: 'info',
      message: 'SELECT has no LIMIT clause and may return an unbounded number of rows.',
    },
  ];
}

// --- Rule: implicit cross join (comma joins) -----------------------------

/** Best-effort check for a top-level comma in a raw `FROM ...` clause,
 * respecting parenthesis nesting and quoted strings/identifiers. Used only
 * as a fallback when the AST doesn't expose a `from` array. */
function hasTopLevelCommaInFromClause(rawText: string): boolean {
  const match = rawText.match(
    /\bfrom\b([\s\S]*?)(?:\bwhere\b|\bgroup\s+by\b|\bhaving\b|\border\s+by\b|\blimit\b|$)/i,
  );
  if (!match) return false;
  const clause = match[1];
  let depth = 0;
  let quote: string | null = null;
  for (const ch of clause) {
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) return true;
  }
  return false;
}

const CROSS_JOIN_ISSUE: LintIssue = {
  ruleId: 'implicit-cross-join',
  severity: 'warning',
  message: 'Comma-style join in FROM produces an implicit cross join — use an explicit JOIN instead.',
};

function checkImplicitCrossJoin(stmt: Node, rawText: string): LintIssue[] {
  const from = stmt.from;
  if (Array.isArray(from)) {
    if (from.length < 2) return [];
    // In an explicit `JOIN`, every table after the first carries a `join`
    // key (e.g. "INNER JOIN"); a comma join does not.
    const hasCommaJoin = from.slice(1).some((item) => isObject(item) && !('join' in item));
    return hasCommaJoin ? [CROSS_JOIN_ISSUE] : [];
  }
  // The AST didn't expose a `from` array for this statement type/dialect —
  // fall back to a text heuristic.
  if (stmt.type === 'select' && hasTopLevelCommaInFromClause(rawText)) {
    return [CROSS_JOIN_ISSUE];
  }
  return [];
}

// --- Rule: `= NULL` comparisons -------------------------------------------

function checkEqualsNull(stmt: Node): LintIssue[] {
  let found = false;
  walk(stmt, (node) => {
    if (found) return;
    if (nodeType(node) !== 'binary_expr') return;
    if (node.operator !== '=') return;
    if (isNullLiteral(node.left) || isNullLiteral(node.right)) {
      found = true;
    }
  });
  if (!found) return [];
  return [
    {
      ruleId: 'eq-null',
      severity: 'warning',
      message: 'Use IS NULL instead of = NULL — a direct equality comparison with NULL never matches.',
    },
  ];
}

// --- Rule: leading-wildcard LIKE ------------------------------------------

function checkLeadingWildcardLike(stmt: Node, rawText: string): LintIssue[] {
  let found = false;
  walk(stmt, (node) => {
    if (found) return;
    if (nodeType(node) !== 'binary_expr') return;
    if (typeof node.operator !== 'string' || !/like$/i.test(node.operator)) return;
    const pattern = stringLiteralValue(node.right);
    if (pattern && (pattern.startsWith('%') || pattern.startsWith('_'))) {
      found = true;
    }
  });
  if (!found) {
    // Fall back to a text match for patterns the AST walk didn't resolve to
    // a plain string literal (e.g. an unusual dialect-specific encoding).
    found = /\b(?:not\s+)?i?like\s+['"](%|_)/i.test(rawText);
  }
  if (!found) return [];
  return [
    {
      ruleId: 'leading-wildcard-like',
      severity: 'warning',
      message: "LIKE pattern starts with a wildcard (% or _) — this can't use a standard index and forces a full scan.",
    },
  ];
}

const SEVERITY_RANK: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Runs every lint rule against one statement's AST node. `rawText` is that
 * statement's own source text (from `splitStatements`), used by rules'
 * text-based fallback checks. Results are sorted error, then warning, then
 * info. */
export function lintStatement(stmt: Node, rawText: string): LintIssue[] {
  const issues = [
    ...checkSelectStar(stmt, rawText),
    ...checkMissingWhere(stmt),
    ...checkMissingLimit(stmt),
    ...checkImplicitCrossJoin(stmt, rawText),
    ...checkEqualsNull(stmt),
    ...checkLeadingWildcardLike(stmt, rawText),
  ];
  return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
