/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vitest.browser.config.ts
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-13
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'
import mdPlugin, {Mode} from 'vite-plugin-markdown'
import {playwright} from '@vitest/browser-playwright'
import {fileURLToPath} from 'url'

const chromiumWebGLArgs = [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
    '--enable-unsafe-swiftshader',
]
const browserLaunchEnv = {...process.env}

delete browserLaunchEnv.DISPLAY
delete browserLaunchEnv.WAYLAND_DISPLAY
delete browserLaunchEnv.DBUS_SESSION_BUS_ADDRESS
const firefoxBrowserEnv: Record<string, string | undefined> = {
    ...browserLaunchEnv,
    LIBGL_ALWAYS_SOFTWARE: '1',
}

if (process.env.LGS1920_VITEST_BROWSER_XVFB === '1' && process.env.DISPLAY) {
    firefoxBrowserEnv.DISPLAY = process.env.DISPLAY
}

export default defineConfig({
    plugins: [
        react(),
        mdPlugin({mode: [Mode.HTML, Mode.MARKDOWN]}),
    ],
    test: {
        name: 'browser',
        include: ['src/__tests__/browser/**/*.{test,spec}.{js,jsx,ts,tsx}'],
        setupFiles: ['./src/__tests__/browser/webgl2-preflight.setup.js'],
        api: {
            host: '127.0.0.1',
            port: 63316,
        },
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
                {
                    browser: 'chromium',
                    name: 'Chromium',
                    provider: playwright({launchOptions: {args: chromiumWebGLArgs, env: browserLaunchEnv}}),
                },
                {
                    browser: 'firefox',
                    name: 'Firefox',
                    provider: playwright({launchOptions: {
                        env: firefoxBrowserEnv,
                        firefoxUserPrefs: {
                            'webgl.force-enabled': true,
                            'webgl.forbid-software': false,
                        },
                    }}),
                },
                {
                    browser: 'webkit',
                    name: 'WebKit',
                    provider: playwright({launchOptions: {env: browserLaunchEnv}}),
                },
            ],
        },
    },
    resolve: {
        dedupe: [
            '@awesome.me/webawesome',
        ],
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
