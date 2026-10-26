import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Workspace packages ship TypeScript source, so bundle them; keep third-party deps external.
  noExternal: [/^@stellar-health\//],
});
