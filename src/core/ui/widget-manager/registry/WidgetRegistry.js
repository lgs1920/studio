/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetRegistry.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-31
 * Last modified: 2026-01-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { lazy } from 'react'

/**
 * WidgetRegistry - Robust Singleton
 * Handles component discovery with collision detection.
 */
export class WidgetRegistry {
    static _instance = null
    #modules = {}
    #nameIndex = new Map()

    constructor() {
        if (WidgetRegistry._instance) {
            return WidgetRegistry._instance
        }

        // Scan directories using Vite glob import
        this.#modules = import.meta.glob([
                                             '/src/components/MainUI/widgets/list/*Widget*.jsx',
                                             '/src/components/MainUI/widgets/list/**/*Widget*.jsx',
                                             '/src/components/Profile/*Widget*.jsx',
                                             '/src/components/Text/*Widget*.jsx',
                                             '/src/components/Stats/*Widget*.jsx',
                                         ])

        this.#buildIndex()
        WidgetRegistry._instance = this
    }

    /**
     * Build a flat index for quick access by component name.
     * Prevents overwriting in case of collision to maintain consistency.
     */
    #buildIndex() {
        for (const path in this.#modules) {
            const name = path.split('/').pop().replace('.jsx', '')

            if (this.#nameIndex.has(name)) {
                // Production log: maintain first discovered path and warn about collision
                console.warn(`[WidgetRegistry] Collision detected for "${name}". Skipping: ${path}. Already registered: ${this.#nameIndex.get(name)}`)
                continue
            }

            this.#nameIndex.set(name, path)
        }
    }

    /**
     * Get component by name or full path
     * @param {string} identifier - Component name (CreditsWidget) or full path (/src/...)
     * @returns {React.LazyExoticComponent|null}
     */
    getLazyComponent(identifier) {
        const resolvedPath = this.#modules[identifier] ? identifier : this.#nameIndex.get(identifier)
        const importFn = this.#modules[resolvedPath]

        if (!importFn) {
            console.error(`[WidgetRegistry] Component not found: "${identifier}"`)
            return null
        }

        return lazy(() =>
                        importFn().then(module => {
                            // Ensure we return an object compatible with React.lazy ({ default: Component })
                            if (module.default) {
                                return module
                            }

                            const name = resolvedPath.split('/').pop().replace('.jsx', '')
                            if (module[name]) {
                                return {default: module[name]}
                            }

                            return {default: module}
                        }).catch(err => {
                            console.error(`[WidgetRegistry] Critical error loading "${resolvedPath}":`, err)
                            throw err
                        })
        )
    }

    /**
     * Check for duplicates in the registry
     * @returns {string[]} List of duplicated component names
     */
    getCollisions() {
        const seen = new Set()
        const collisions = new Set()

        for (const path in this.#modules) {
            const name = path.split('/').pop()
            if (seen.has(name)) {
                collisions.add(name)
            }
            seen.add(name)
        }
        return Array.from(collisions)
    }
}

// Export a single instance to ensure singleton pattern across the app
export const $widgetRegistry = new WidgetRegistry()
