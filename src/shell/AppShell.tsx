import { useCallback, useEffect, useState } from 'react';
import { toolConfig } from '../tool.config';
import { Tool } from '../tool/Tool';
import {
  getEmbedState,
  listenForThemeMessages,
  postEmbedReady,
  setupEmbedResize,
  type Theme,
} from './embed';

const THEME_STORAGE_KEY = 'mmoall-tool-theme';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Private browsing / blocked storage — fall back to system preference.
    return null;
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore — this is only a per-viewer convenience.
  }
}

export default function AppShell() {
  const [embedState] = useState(() => getEmbedState());

  const [theme, setTheme] = useState<Theme>(() => {
    if (embedState.initialTheme) return embedState.initialTheme;
    if (!embedState.isEmbed) {
      const stored = readStoredTheme();
      if (stored) return stored;
    }
    return systemTheme();
  });

  // Whether `theme` should be pinned via the data-theme attribute, or the OS
  // `prefers-color-scheme` should keep driving it. Embed mode and any
  // explicit user/parent-frame choice pin it.
  const [themeIsPinned, setThemeIsPinned] = useState<boolean>(
    () => embedState.isEmbed || readStoredTheme() !== null,
  );

  useEffect(() => {
    const root = document.documentElement;
    if (themeIsPinned) {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme, themeIsPinned]);

  // Embed mode must render on a transparent background so the host page
  // shows through around the tool.
  useEffect(() => {
    if (!embedState.isEmbed) return;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, [embedState.isEmbed]);

  useEffect(
    () =>
      listenForThemeMessages((nextTheme) => {
        setTheme(nextTheme);
        setThemeIsPinned(true);
      }),
    [],
  );

  useEffect(() => {
    if (!embedState.isEmbed) return;
    postEmbedReady(toolConfig.slug);
    return setupEmbedResize(toolConfig.slug);
  }, [embedState.isEmbed]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      writeStoredTheme(next);
      return next;
    });
    setThemeIsPinned(true);
  }, []);

  if (embedState.isEmbed) {
    return (
      <div className="p-2 sm:p-3">
        <Tool />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{toolConfig.name}</h1>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]">
              {toolConfig.category}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://mmoall.com/tools"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              More tools on MMOALL
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm hover:bg-[var(--color-panel)]"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Tool />
        </div>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-[var(--color-muted)]">
          <span>
            Part of{' '}
            <a href="https://mmoall.com" className="text-[var(--color-accent)] hover:underline">
              MMOALL Developer Tools
            </a>
          </span>
          <a
            href={`https://github.com/techshield-tech/${toolConfig.slug}`}
            className="text-[var(--color-accent)] hover:underline"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
