// import { defineConfig } from 'vite';
// import laravel from 'laravel-vite-plugin';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//     plugins: [
//         laravel({
//             input: ['resources/js/main.jsx'],
//             refresh: true,
//         }),
//         react(),
//     ],
//     // build: {
//     //     outDir: 'public/build',
//     //     manifest: 'manifest.json',  // ← FORCE the name and location
//     //     rollupOptions: {
//     //         input: ['resources/js/main.jsx'],
//     //         output: {
//     //             entryFileNames: 'assets/[name]-[hash].js',
//     //             chunkFileNames: 'assets/[name]-[hash].js',
//     //             assetFileNames: 'assets/[name]-[hash].[ext]',
//     //         },
//     //     },
//     // },
// });


// vite.config.js usa ra ni
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/main.jsx'],
            refresh: true,
        }),
        react(),
    ],
    // ✅ Optimized build configuration
    build: {
        outDir: 'public/build',
        manifest: 'manifest.json',
        rollupOptions: {
            input: ['resources/js/main.jsx'],
            output: {
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
            },
        },
        // ✅ Optimize chunk size
        chunkSizeWarningLimit: 1000,
        // ✅ Minify for production
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: process.env.NODE_ENV === 'production',
                drop_debugger: process.env.NODE_ENV === 'production',
            },
        },
        // ✅ Better source maps for debugging
        sourcemap: process.env.NODE_ENV !== 'production',
        // ✅ Target modern browsers
        target: 'es2015',
    },
    // ✅ Development server optimization
    server: {
        hmr: {
            host: 'localhost',
        },
        watch: {
            usePolling: true,
        },
    },
    // ✅ Optimize dependencies
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
            'axios',
            'date-fns',
            'recharts',
        ],
    },
    // ✅ Resolve aliases for cleaner imports
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});