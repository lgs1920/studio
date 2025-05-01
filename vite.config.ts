/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vite.config.ts
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-01
 * Last modified: 2025-05-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

import data from './public/version.json' with {type: 'json'};

const version = data.studio

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), cesium(),
        {
            name: 'markdown-loader',
            transform(code, id) {
                if (id.slice(-3) === '.md') {
                    return `export default ${JSON.stringify(code)};`
                }
            },
        },
    ],
    server: {
        host: '0.0.0.0',  // Écoute sur toutes les interfaces
        port: 5173        // Le port que vous souhaitez utiliser
    },

    define: {
        global: {},
    },
    build: {
        sourcemap: true,
        minify: 'esbuild',
        target: 'esnext',
        chunkSizeWarningLimit: 500000,
        outDir: `./dist/${version}`,
        rollupOptions: {
            output: {
                // manualChunks(id: string) {
                //     if (id.indexOf('node_modules') !== -1) {
                //         const basic = id.toString().split('node_modules/')[1];
                //         const sub1 = basic.split('/')[0];
                //         if (sub1 !== '.pnpm') {
                //             return sub1.toString();
                //         }
                //         const name2 = basic.split('/')[1];
                //         return name2.split('@')[name2[0] === '@' ? 1 : 0].toString();
                //     }
                // },
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
                find: '@Core',
                replacement: Bun.fileURLToPath(new URL('./src/core', import.meta.url))
            },
        ]
    }
})