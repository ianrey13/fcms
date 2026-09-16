// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/main.jsx'],
            refresh: true,
        }),
        react(),
        visualizer({
            filename: 'public/build/stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
        }),
    ],
    // ✅ FIX: Expose `L` to plugins that expect a global
    define: {
        global: 'globalThis',
    },
    build: {
        outDir: 'public/build',
        manifest: 'manifest.json',
        rollupOptions: {
            input: ['resources/js/main.jsx'],
            output: {
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',

                manualChunks(id) {
                    if (!id.includes('node_modules')) return;

                    if (id.includes('react-router')) return 'vendor-react';
                    if (id.includes('react-dom')) return 'vendor-react';
                    if (id.includes('/react/')) return 'vendor-react';

                    if (id.includes('@tanstack/react-query')) return 'vendor-query';
                    if (id.includes('axios')) return 'vendor-http';

                    if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';

                    // ✅ MAPS — Leaflet + plugins MUST be together
                    // so that `L` global set by leaflet is visible to leaflet-routing-machine
                    if (id.includes('leaflet') || id.includes('maplibre') || id.includes('mapbox')) {
                        return 'vendor-maps';
                    }

                    if (id.includes('lucide-react')) return 'vendor-icons';

                    if (id.includes('date-fns')) return 'vendor-date';
                    if (id.includes('moment')) return 'vendor-date';

                    if (id.includes('@radix-ui')) return 'vendor-ui';
                    if (id.includes('@headlessui')) return 'vendor-ui';

                    if (id.includes('framer-motion')) return 'vendor-animation';

                    if (id.includes('react-hot-toast') || id.includes('sonner')) return 'vendor-notify';

                    if (id.includes('react-hook-form') || id.includes('zod')) return 'vendor-forms';

                    if (id.includes('chart.js') || id.includes('apexcharts')) return 'vendor-charts';

                    return 'vendor-misc';
                }
            },
        },
        chunkSizeWarningLimit: 1500, // bumped — vendor-maps is ~700KB
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: process.env.NODE_ENV === 'production',
                drop_debugger: process.env.NODE_ENV === 'production',
            },
        },
        sourcemap: process.env.NODE_ENV !== 'production',
        target: 'es2015',
    },
    server: {
        hmr: {
            host: 'localhost',
        },
        watch: {
            usePolling: true,
        },
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
            'axios',
            'date-fns',
            'recharts',
            'leaflet',
            'leaflet-routing-machine',
        ],
    },
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});