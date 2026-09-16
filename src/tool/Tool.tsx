import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ErrorBox, Panel, Select, TextArea, Toolbar } from '../shell/ui';
import { SAMPLE_SQL } from './sample';
import { lintStatement, type LintIssue, type LintSeverity } from './sql-lint';
import {
  DEFAULT_DIALECT,
  DIALECTS,
  formatReferenceList,
  formatSqlError,
  parseSql,
  splitStatements,
  statementLabel,
  type ParseResult,
} from './sql-parser';

// Above this size, validation only happens on an explicit action (button
// click or Ctrl/Cmd+Enter) — never on a debounce timer.
const AUTO_VALIDATE_MAX_BYTES = 100 * 1024;
const DEBOUNCE_MS = 300;

function byteSize(value: string): number {
  return new TextEncoder().encode(value).length;
}

interface StatementReport {
  index: number;
  label: string;
  sourcePreview: string;
  issues: LintIssue[];
}

const SEVERITY_STYLES: Record<LintSeverity, { badge: string; dot: string }> = {
  error: {
    badge: 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
    dot: 'bg-[var(--color-danger)]',
  },
  warning: {
    badge: 'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  info: {
    badge: 'border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)]',
    dot: 'bg-[var(--color-muted)]',
  },
};

function previewOf(text: string, max = 90): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

export function Tool() {
  const [sql, setSql] = useState('');
  const [dialect, setDialect] = useState(DEFAULT_DIALECT);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [reports, setReports] = useState<StatementReport[]>([]);
  const debounceRef = useRef<number | null>(null);
  // Guards against an older, slower validation request overwriting a newer
  // one's result if they resolve out of order.
  const requestIdRef = useRef(0);

  const runValidate = useCallback(async (source: string, dialectValue: string) => {
    if (source.trim() === '') {
      setResult(null);
      setReports([]);
      setPending(false);
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPending(true);
    const parsed = await parseSql(source, dialectValue);
    if (requestIdRef.current !== requestId) return;
    setPending(false);
    setResult(parsed);
    if (parsed.ok) {
      const rawStatements = splitStatements(source);
      setReports(
        parsed.statements.map((stmt, index) => {
          const rawText = rawStatements[index] ?? '';
          return {
            index,
            label: statementLabel(stmt),
            sourcePreview: previewOf(rawText),
            issues: lintStatement(stmt, rawText),
          };
        }),
      );
    } else {
      setReports([]);
    }
  }, []);

  const handleValidateClick = useCallback(() => {
    runValidate(sql, dialect);
  }, [runValidate, sql, dialect]);

  // Debounced auto-validate, small inputs only.
  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (byteSize(sql) > AUTO_VALIDATE_MAX_BYTES) {
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      runValidate(sql, dialect);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [sql, dialect, runValidate]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleValidateClick();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleValidateClick]);

  const handleClear = useCallback(() => {
    setSql('');
    setResult(null);
    setReports([]);
  }, []);

  const handleLoadSample = useCallback(() => {
    setSql(SAMPLE_SQL);
  }, []);

  const tableList = useMemo(() => (result?.ok ? formatReferenceList(result.tableList) : []), [result]);
  const columnList = useMemo(() => (result?.ok ? formatReferenceList(result.columnList) : []), [result]);
  const totalIssues = useMemo(
    () => reports.reduce((sum, report) => sum + report.issues.length, 0),
    [reports],
  );

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <Select
          aria-label="SQL dialect"
          value={dialect}
          onChange={(event) => setDialect(event.target.value)}
          options={DIALECTS}
        />
        <Button variant="primary" onClick={handleValidateClick} disabled={pending}>
          {pending ? 'Validating…' : 'Validate'}
        </Button>
        <Button variant="ghost" onClick={handleLoadSample}>
          Load sample
        </Button>
        <Button variant="ghost" onClick={handleClear}>
          Clear
        </Button>
      </Toolbar>

      <Panel
        title="SQL input"
        actions={
          result?.ok ? (
            <span className="text-xs text-[var(--color-muted)]">
              {result.statements.length} statement{result.statements.length === 1 ? '' : 's'}
            </span>
          ) : undefined
        }
      >
        <TextArea
          aria-label="SQL input"
          value={sql}
          onChange={(event) => setSql(event.target.value)}
          placeholder="Paste one or more SQL statements, separated by semicolons…"
          className="min-h-[200px]"
        />
      </Panel>

      {result && !result.ok && (
        <ErrorBox>
          <div className="font-medium">Syntax error</div>
          <div className="mt-1 font-mono text-xs break-words whitespace-pre-wrap">
            {formatSqlError(result.error)}
          </div>
        </ErrorBox>
      )}

      {result?.ok && (
        <Panel title="Summary">
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--color-fg)]">
              <div>
                <span className="text-[var(--color-muted)]">Statements: </span>
                <span className="font-medium">{result.statements.length}</span>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Lint findings: </span>
                <span className="font-medium">{totalIssues}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {reports.map((report) => (
                <span
                  key={report.index}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-0.5 text-xs font-medium text-[var(--color-fg)]"
                  title={report.sourcePreview}
                >
                  #{report.index + 1} {report.label}
                </span>
              ))}
            </div>

            <ReferenceList title="Tables referenced" items={tableList} />
            <ReferenceList title="Columns referenced" items={columnList} />
          </div>
        </Panel>
      )}

      {result?.ok && reports.length > 0 && (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <Panel
              key={report.index}
              title={`Statement ${report.index + 1} — ${report.label}`}
              actions={
                <span className="text-xs text-[var(--color-muted)]">
                  {report.issues.length === 0
                    ? 'No issues'
                    : `${report.issues.length} finding${report.issues.length === 1 ? '' : 's'}`}
                </span>
              }
            >
              <div className="flex flex-col gap-2">
                <div
                  className="truncate font-mono text-xs text-[var(--color-muted)]"
                  title={report.sourcePreview}
                >
                  {report.sourcePreview || '(empty statement)'}
                </div>
                {report.issues.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">No lint findings for this statement.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {report.issues.map((issue, issueIndex) => (
                      <li
                        key={`${issue.ruleId}-${issueIndex}`}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${SEVERITY_STYLES[issue.severity].badge}`}
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEVERITY_STYLES[issue.severity].dot}`}
                          aria-hidden="true"
                        />
                        <span>
                          <span className="mr-1.5 rounded-sm text-[10px] font-semibold tracking-wide uppercase opacity-80">
                            {issue.severity}
                          </span>
                          {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[var(--color-muted)]">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">None</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <code
              key={item}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-fg)]"
            >
              {item}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}
