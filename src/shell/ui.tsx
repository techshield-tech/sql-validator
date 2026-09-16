// Tiny, generic UI primitives shared across the whole MMOALL dev tools
// family. Nothing in this file may reference JSON (or any other specific
// tool's domain) — sibling repos reuse this file verbatim.

import { useState } from 'react';
import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent hover:opacity-90',
  secondary:
    'bg-[var(--color-panel)] text-[var(--color-fg)] border-[var(--color-border)] hover:bg-[var(--color-border)]',
  ghost: 'bg-transparent text-[var(--color-fg)] border-transparent hover:bg-[var(--color-panel)]',
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = '', ...props }: TextAreaProps) {
  return (
    <textarea
      spellCheck={false}
      className={`w-full flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3 font-mono text-sm leading-relaxed text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] ${className}`}
      {...props}
    />
  );
}

export interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function Panel({ title, children, className = '', actions }: PanelProps) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
          {title ? <h2 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h2> : <span />}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex flex-1 flex-col p-3">{children}</div>
    </div>
  );
}

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export function Toolbar({ children, className = '' }: ToolbarProps) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export interface CopyButtonProps {
  /** Lazily computed so the latest value is copied even if this button is memoized. */
  getText: () => string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  getText,
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or permission denied — nothing else to
      // fall back to without touching the network, so fail silently.
    }
  };

  return (
    <Button variant="secondary" onClick={handleClick} className={className}>
      {copied ? copiedLabel : label}
    </Button>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
    >
      {children}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
}

export function Select({ options, className = '', ...props }: SelectProps) {
  return (
    <select
      className={`rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] ${className}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
