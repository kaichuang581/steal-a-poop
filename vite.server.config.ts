import { defineConfig } from 'vite';

// Builds the game server into one file (dist-server/main.mjs). Packages from node_modules stay external and are installed in the image.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'main.mjs' } },
  },
});
