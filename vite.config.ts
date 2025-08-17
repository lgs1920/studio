/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vite.config.ts
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-17
 * Last modified: 2025-08-17
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
import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';


function saveBranchInLocal() {
    return {
        name: 'inject-git-branch',
        apply: 'serve',
        configureServer() {
            const branchPath = path.resolve(__dirname, 'public/branch.json');
            const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

            let branchData = {};
            if (fs.existsSync(branchPath)) {
                branchData = JSON.parse(fs.readFileSync(branchPath, 'utf-8'));
            }

            if (branchData.branch !== branch) {
                branchData.branch = branch;
                fs.writeFileSync(branchPath, JSON.stringify(branchData, null, 2));
                console.log(`✅ Git branch "${branch}" injected into branch.json`);
            } else {
                console.log(`ℹ️ Git branch "${branch}" already present in branch.json`);
            }
        }
    };
}


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
            manifest: false,
            manifestFilename: 'manifest.webmanifest'
        }),
        mdPlugin({mode: ['html', 'markdown']}),
        saveBranchInLocal()
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