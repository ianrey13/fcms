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
            open: false, // ✅ Disabled auto-open (annoying in prod builds)
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
        }),
    ],
    // ✅ Expose `global` for plugins that expect it
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

                    // ✅ CRITICAL: Leaflet CORE must be its own chunk
                    // loaded BEFORE leaflet-routing-machine
                    if (
                        id.includes('node_modules/leaflet/') &&
                        !id.includes('leaflet-routing')
                    ) {
                        return 'vendor-leaflet';
                    }

                    // ✅ Routing machine depends on global L — separate chunk
                    if (id.includes('leaflet-routing-machine')) {
                        return 'vendor-leaflet-routing';
                    }

                    // Other map libs
                    if (id.includes('maplibre') || id.includes('mapbox')) {
                        return 'vendor-maps';
                    }

                    if (id.includes('react-router')) return 'vendor-react';
                    if (id.includes('react-dom')) return 'vendor-react';
                    if (id.includes('/react/')) return 'vendor-react';

                    if (id.includes('@tanstack/react-query')) return 'vendor-query';
                    if (id.includes('axios')) return 'vendor-http';

                    if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
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
        chunkSizeWarningLimit: 1500,
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
        // ✅ PROXY — routes /api and /broadcasting to Laravel backend (:8000)
        // Without this, calls to /api/broadcasting/auth hit Vite (:5173) and 404.
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/broadcasting': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/sanctum': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
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
            // ✅ DO NOT include 'leaflet-routing-machine' here —
            // it needs to be lazy-loaded after window.L is set
        ],
    },
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});