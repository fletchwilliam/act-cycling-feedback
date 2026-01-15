import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Base public path - adjust if deploying to a subdirectory
    base: './',

    // Development server options
    server: {
        port: 3000,
        open: true,
        cors: true
    },

    // Build options
    build: {
        outDir: 'dist',
        sourcemap: true,
        minify: 'esbuild',

        // Rollup options for bundling
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            },
            output: {
                // Entry chunk naming
                entryFileNames: 'js/[name]-[hash].js',
                // Code-split chunk naming
                chunkFileNames: 'js/[name]-[hash].js',
                // Asset naming (CSS, images, etc.)
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name.endsWith('.css')) {
                        return 'css/[name]-[hash][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                }
            }
        },

        // Chunk size warnings threshold (kB)
        chunkSizeWarningLimit: 500
    },

    // Optimize dependencies
    optimizeDeps: {
        include: []
    },

    // CSS processing options
    css: {
        devSourcemap: true
    },

    // Define environment variables
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
    }
});
