/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vitest.config.ts
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-05-04
 * Last modified: 2026-09-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'
import mdPlugin, {Mode} from 'vite-plugin-markdown'
import {fileURLToPath} from 'url'

const domUnitTestFiles = [
    'src/__tests__/unit/assets/welcome-background-media.test.js',
    'src/__tests__/unit/camera/camera-manager-orbit.test.js',
    'src/__tests__/unit/data/app-utils-count.test.js',
    'src/__tests__/unit/data/database-sync-manager.test.js',
    'src/__tests__/unit/data/deferred-journey-data.test.js',
    'src/__tests__/unit/data/metrics.test.js',
    'src/__tests__/unit/dom/canvas-context.test.js',
    'src/__tests__/unit/events/canvas-event-manager.test.js',
    'src/__tests__/unit/events/native-context-menu-blocker.test.js',
    'src/__tests__/unit/replay/replay-camera-angle-guide.test.js',
    'src/__tests__/unit/replay/replay-camera-overlay.test.js',
    'src/__tests__/unit/replay/replay-recording-monitor.test.js',
    'src/__tests__/unit/replay/replay-duplicate-samples.test.js',
    'src/__tests__/unit/replay/replay-sampler.test.js',
    'src/__tests__/unit/replay/replay-video-overlay-composer.test.js',
    'src/__tests__/unit/replay/replay-visibility-clips.test.js',
    'src/__tests__/unit/ui/app-update-manager.test.js',
    'src/__tests__/unit/ui/widget-dock-manager.test.js',
    'src/__tests__/unit/ui/widget-window-manager.test.js',
    'src/__tests__/unit/utils/managed-stylesheet.test.jsx',
    'src/__tests__/unit/utils/tiles3d-error-labels.test.js',
    'src/__tests__/unit/widgets/camera-adjustment-widget-position.test.js',
    'src/__tests__/unit/widgets/widget-preview-rotation.test.js',
    'src/__tests__/unit/journey/journey-gpx.test.js',
    'src/core/ui/panels/drawerResize.test.js',
]

export default defineConfig({
    plugins: [
        react(),
        mdPlugin({mode: [Mode.HTML, Mode.MARKDOWN]}),
    ],
    test: {
        globals: true,
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    environment: 'node',
                    include: [
                        'src/__tests__/unit/**/*.{test,spec}.{js,jsx,ts,tsx}',
                        'deployment/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
                        'src/core/**/*.test.{js,jsx,ts,tsx}',
                    ],
                    exclude: domUnitTestFiles,
                },
            },
            {
                extends: true,
                test: {
                    name: 'ui',
                    environment: 'jsdom',
                    include: [
                        'src/__tests__/ui/**/*.{test,spec}.{js,jsx,ts,tsx}',
                        'src/components/**/*.test.{js,jsx,ts,tsx}',
                        'src/webcomponents/**/*.test.{js,jsx,ts,tsx}',
                        ...domUnitTestFiles,
                    ],
                    setupFiles: ['./src/__tests__/setup.js'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'integration',
                    environment: 'jsdom',
                    include: [
                        'src/__tests__/integration/**/*.{test,spec}.{js,jsx,ts,tsx}',
                    ],
                    setupFiles: ['./src/__tests__/setup.js'],
                },
            },
        ],
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
})
