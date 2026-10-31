import { defineConfig } from 'vite';

/**
 * Vite configuration for the ICON ELECTROMATIC site.
 *
 * The key addition is the `rollupOptions` block which explicitly
 * defines the entry HTML file and ensures all emitted assets use
 * relative placeholders. This eliminates the “absolute path” error
 * that occurs on Windows during production builds.
 */
export default defineConfig({
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Explicit Rollup options – required for Windows environments.
    rollupOptions: {
      // Ensure Vite knows the HTML entry point.
      input: 'index.html',
      output: {
        // Use hashed filenames for cache busting across deployments
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
