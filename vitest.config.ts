/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vitest.config.ts
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import mdPlugin, {Mode} from 'vite-plugin-markdown';
import {fileURLToPath} from 'url';

export default defineConfig({
    plugins: [
        react(),
        mdPlugin({mode: [Mode.HTML, Mode.MARKDOWN]}),
    ],
    test: {
        environment: 'jsdom',
        globals: true,
        include: [
            '**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
            'src/webcomponents/**/*.test.{js,jsx,ts,tsx}',
        ],
        setupFiles: ['./src/__tests__/setup.js'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    },
    resolve: {
        alias: {
            '@Utils': fileURLToPath(new URL('./src/Utils', import.meta.url)),
            '@Editor': fileURLToPath(new URL('./src/components/TracksEditor', import.meta.url)),
            '@Components': fileURLToPath(new URL('./src/components', import.meta.url)),
            '@Core': fileURLToPath(new URL('./src/core', import.meta.url)),
            '@Stores': fileURLToPath(new URL('./src/core/stores', import.meta.url)),
            '@Locales': fileURLToPath(new URL('./src/locales', import.meta.url)),
            '@Assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
            '@Widgets': fileURLToPath(new URL('./src/components/MainUI/widgets', import.meta.url)),
            '@Settings': fileURLToPath(new URL('./src/components/Settings', import.meta.url)),
            '@Tests': fileURLToPath(new URL('./src/__tests__', import.meta.url)),
            '@Events': fileURLToPath(new URL('./src/core/events', import.meta.url)),
            '@UI': fileURLToPath(new URL('./src/core/ui', import.meta.url)),
            '@Database': fileURLToPath(new URL('./src/core/db', import.meta.url)),
        },
    },
});
