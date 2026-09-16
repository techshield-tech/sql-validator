import { defineConfig, loadEnv } from 'vite';
import { mmoallTool } from '@mmoall/tool-kit/vite';
import { toolConfig } from './src/tool.config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return mmoallTool(toolConfig, { env });
});
