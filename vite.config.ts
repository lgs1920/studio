/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vite.config.ts
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-11
 * Last modified: 2026-04-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'
import {VitePWA} from 'vite-plugin-pwa'
import mdPlugin from 'vite-plugin-markdown'
import data from './public/version.json' with {type: 'json'}
import {execSync} from 'child_process'
import fs from 'fs'
import path from 'path'
import serveStatic from 'serve-static'

/**
 * Injects current git branch name into a local JSON file for development tracking.
 * Runs only during dev server execution.
 */
function saveBranchInLocal() {
    return {
        name: 'inject-git-branch',
        apply: 'serve' as const,
        configureServer() {
            const _branchPath = path.resolve(__dirname, 'public/branch.json')
            const _branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()

            let _branchData: { branch?: string } = {}
            if (fs.existsSync(_branchPath)) {
                _branchData = JSON.parse(fs.readFileSync(_branchPath, 'utf-8'))
            }

            if (_branchData.branch !== _branch) {
                _branchData.branch = _branch
                fs.writeFileSync(_branchPath, JSON.stringify(_branchData, null, 2))
            }
        }
    }
}

/**
 * Dev-only fallback to ensure Cesium static assets are served at /cesium/.
 * This avoids SPA fallback returning index.html for Cesium JSON assets.
 */
function serveCesiumDev() {
    return {
        name: 'serve-cesium-dev',
        apply: 'serve' as const,
        configureServer({middlewares}) {
            const _engineSource = path.resolve(__dirname, 'node_modules/@cesium/engine/Source')
            const _widgetsSource = path.resolve(__dirname, 'node_modules/@cesium/widgets/Source')

            const _serveEngine = serveStatic(_engineSource, {
                setHeaders: (res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*')
                },
            })

            const _serveWidgets = serveStatic(_widgetsSource, {
                setHeaders: (res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*')
                },
            })

            middlewares.use((req, res, next) => {
                if (!req.url) return next()

                if (req.url.startsWith('/cesium/Widgets/')) {
                    const _originalUrl = req.url
                    req.url = req.url.replace('/cesium/Widgets', '')
                    return _serveWidgets(req, res, (err) => {
                        req.url = _originalUrl
                        if (err) return next(err)
                        return next()
                    })
                }

                if (req.url.startsWith('/cesium/')) {
                    const _originalUrl = req.url
                    req.url = req.url.replace('/cesium', '')
                    return _serveEngine(req, res, (err) => {
                        req.url = _originalUrl
                        if (err) return next(err)
                        return next()
                    })
                }

                return next()
            })
        },
    }
}

const version = data.studio

export default defineConfig({
    plugins: [
        cesium(),
        serveCesiumDev(),
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            filename: 'service-worker-pwa.js',
            srcDir: 'public',
            injectManifest: {
                injectionPoint: undefined,
            },
            manifest: false,
            manifestFilename: 'manifest.webmanifest',
            devOptions: {
                enabled: true,
                type: 'module'
            }
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
        /** Force WebStorm (WSL) as editor for the error overlay */
        launchEditor: 'webstorm',
        strictPort: true,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        }
    },

    build: {
        sourcemap: true,
        minify: 'esbuild',
        target: 'esnext',
        chunkSizeWarningLimit: 500000,
        outDir: `./dist/${version}`,
        rollupOptions: {
            output: {
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: ({name}) => {
                    if (name?.endsWith('.css')) {
                        return 'assets/css/[name]-[hash][extname]'
                    }
                    return 'assets/[name]-[hash][extname]'
                }
            }
        }
    },

    resolve: {
        alias: [
            {
                find: '@Utils',
                replacement: path.resolve(__dirname, 'src/Utils')
            },
            {
                find: '@Editor',
                replacement: path.resolve(__dirname, 'src/components/TracksEditor')
            },
            {
                find: '@Components',
                replacement: path.resolve(__dirname, 'src/components')
            },
            {
                find: '@Stores',
                replacement: path.resolve(__dirname, 'src/core/stores')
            },
            {
                find: '@Core',
                replacement: path.resolve(__dirname, 'src/core')
            },
            {
                find: '@Locales',
                replacement: path.resolve(__dirname, 'src/locales')
            }
        ]
    },
})