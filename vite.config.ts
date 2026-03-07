/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vite.config.ts
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-07
 * Last modified: 2026-03-07
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
            const branchPath = path.resolve(__dirname, 'public/branch.json')
            const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()

            let branchData: any = {}
            if (fs.existsSync(branchPath)) {
                branchData = JSON.parse(fs.readFileSync(branchPath, 'utf-8'))
            }

            if (branchData.branch !== branch) {
                branchData.branch = branch
                fs.writeFileSync(branchPath, JSON.stringify(branchData, null, 2))
                console.log(`✅ Git branch "${branch}" injected into branch.json`)
            } else {
                console.log(`ℹ️ Git branch "${branch}" already present in branch.json`)
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
            const engineSource = path.resolve(__dirname, 'node_modules/@cesium/engine/Source')
            const widgetsSource = path.resolve(__dirname, 'node_modules/@cesium/widgets/Source')
            const serveEngine = serveStatic(engineSource, {
                setHeaders: (res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*')
                },
            })
            const serveWidgets = serveStatic(widgetsSource, {
                setHeaders: (res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*')
                },
            })

            middlewares.use((req, res, next) => {
                if (!req.url) return next()

                if (req.url.startsWith('/cesium/Widgets/')) {
                    const originalUrl = req.url
                    req.url = req.url.replace('/cesium/Widgets', '')
                    return serveWidgets(req, res, (err) => {
                        req.url = originalUrl
                        if (err) return next(err)
                        return next()
                    })
                }

                if (req.url.startsWith('/cesium/')) {
                    const originalUrl = req.url
                    req.url = req.url.replace('/cesium', '')
                    return serveEngine(req, res, (err) => {
                        req.url = originalUrl
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
            /* Immediate update for mobile devices to prevent stale CSS/JS cache */
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            filename: 'service-worker-pwa.js',
            srcDir: 'public',
            injectManifest: {
                /* Set to undefined as manifest logic is handled manually in service-worker-pwa.js */
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
        strictPort: true,
        /* Strict cache control headers to force mobile browsers to fetch latest assets during dev */
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
                /* Ensure unique filenames with hashes to invalidate CDN and browser caches on production */
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
