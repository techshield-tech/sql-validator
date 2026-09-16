import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from '@mmoall/tool-kit';
import { toolConfig } from './tool.config';
import { Tool } from './tool/Tool';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppShell config={toolConfig}>
      <Tool />
    </AppShell>
  </StrictMode>,
);
