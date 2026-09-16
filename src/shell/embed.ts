// Embed mode contract shared by every MMOALL dev tool, so mmoall.com can
// iframe any of them identically. Generic — no tool-specific logic here.

export type Theme = 'light' | 'dark';

const ALLOWED_MESSAGE_ORIGINS = new Set<string>([
  'https://mmoall.com',
  'https://www.mmoall.com',
  'http://localhost:3000',
]);

export interface EmbedState {
  /** True when the page was loaded with ?embed=1. */
  isEmbed: boolean;
  /** Theme requested via ?theme=light|dark, if any. */
  initialTheme: Theme | null;
}

function parseTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

/** Reads embed state from the current URL (or a supplied query string). */
export function getEmbedState(search: string = window.location.search): EmbedState {
  const params = new URLSearchParams(search);
  return {
    isEmbed: params.get('embed') === '1',
    initialTheme: parseTheme(params.get('theme')),
  };
}

interface ThemeMessage {
  type: 'mmoall-tool:theme';
  theme: Theme;
}

function isThemeMessage(data: unknown): data is ThemeMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'mmoall-tool:theme' &&
    ((data as { theme?: unknown }).theme === 'light' ||
      (data as { theme?: unknown }).theme === 'dark')
  );
}

/**
 * Listens for `{type:'mmoall-tool:theme', theme}` messages from an allowed
 * parent origin and invokes `onTheme` with the requested theme. Returns an
 * unsubscribe function.
 */
export function listenForThemeMessages(onTheme: (theme: Theme) => void): () => void {
  function handleMessage(event: MessageEvent): void {
    if (!ALLOWED_MESSAGE_ORIGINS.has(event.origin)) {
      return;
    }
    if (isThemeMessage(event.data)) {
      onTheme(event.data.theme);
    }
  }

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}

/** Posts the initial-load ready signal to the parent frame (embed mode only). */
export function postEmbedReady(slug: string): void {
  if (window.parent === window) {
    return;
  }
  window.parent.postMessage({ type: 'mmoall-tool:ready', slug }, '*');
}

/**
 * Observes the document height and posts
 * `{type:'mmoall-tool:height', slug, height}` to the parent frame whenever
 * it changes, so the embedding page can resize its iframe. Returns a cleanup
 * function that disconnects the observer.
 */
export function setupEmbedResize(slug: string): () => void {
  if (window.parent === window) {
    return () => {};
  }

  const target = document.documentElement;
  let lastHeight = -1;

  const post = (): void => {
    const height = target.scrollHeight;
    if (height === lastHeight) {
      return;
    }
    lastHeight = height;
    window.parent.postMessage({ type: 'mmoall-tool:height', slug, height }, '*');
  };

  const observer = new ResizeObserver(post);
  observer.observe(target);
  post();

  return () => observer.disconnect();
}
