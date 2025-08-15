/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vite.config.ts
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-15
 * Last modified: 2025-08-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import {VitePWA} from 'vite-plugin-pwa';
import mdPlugin from 'vite-plugin-markdown';
import data from './public/version.json' with {type: 'json'};

const version = data.studio

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        cesium(),
        VitePWA({
            registerType: 'prompt',
            strategies: 'injectManifest',
            filename: 'service-worker-pwa.js',
            srcDir: 'public',
            injectManifest: {
                injectionPoint: undefined,
            },
        }),
        mdPlugin({mode: ['html', 'markdown']}),
    ],
    server: {
        allowedHosts: [
            'localhost',
            'dev.lgs1920.fr',
        ],
        host: 'dev.lgs1920.fr',
        port: 5173,
        strictPort: true
    },

    build: {
        sourcemap: true,
        minify: 'esbuild',
        target: 'esnext',
        chunkSizeWarningLimit: 500000,
        outDir: `./dist/${version}`,
        rollupOptions: {
            output: {
                assetFileNames: ({name}) => {
                    if (name.endsWith('.css')) {
                        return 'assets/css/[name].[hash].[ext]';
                    }
                    return 'assets/js/[name].[hash].[ext]';
                }
            }
        }
    },
    resolve: {
        alias: [
            {
                find: '@Utils',
                replacement: Bun.fileURLToPath(new URL('./src/Utils', import.meta.url))
            },
            {
                find: '@Editor',
                replacement: Bun.fileURLToPath(new URL('./src/components/TracksEditor', import.meta.url))
            },
            {
                find: '@Components',
                replacement: Bun.fileURLToPath(new URL('./src/components', import.meta.url))
            },
            {
                find: '@Stores',
                replacement: Bun.fileURLToPath(new URL('./src/core/stores', import.meta.url))
            },
            {
                find: '@Core',
                replacement: Bun.fileURLToPath(new URL('./src/core', import.meta.url))
            },
            {
                find: '@Locales',
                replacement: Bun.fileURLToPath(new URL('./src/locales', import.meta.url))
            },
        ]
    },
    optimizeDeps: {
        exclude: [
            '@ffmpeg/core',
            '@ffmpeg/ffmpeg',
            '@ffmpeg/util',
        ],
    },
})