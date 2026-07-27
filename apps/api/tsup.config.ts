import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @recoverai/shared and @recoverai/config ship raw TypeScript source (see
  // docs/ARCHITECTURE.md - no build step for internal packages). tsup treats
  // workspace packages as external by default because they're listed under
  // "dependencies"; without this, plain `node dist/server.js` can't resolve
  // their extensionless relative imports at runtime. Forcing them in here
  // means the production bundle is fully self-contained.
  noExternal: [/^@recoverai\//],
});
