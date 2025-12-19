/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetRegistry.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-19
 * Last modified: 2025-12-19
 *
 *
 * Copyright © 2025 LGS1920
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

        // Scan directories
        this.#modules = import.meta.glob([
                                             '/src/components/MainUI/widgets/list/*Widget.jsx',
                                             '/src/components/MainUI/widgets/list/**/*Widget.jsx',
                                             '/src/components/Profile/*Widget.jsx',
                                         ])
        this.#buildIndex()
        WidgetRegistry._instance = this
    }

    #buildIndex() {
        for (const path in this.#modules) {
            const name = path.split('/').pop().replace('.jsx', '')

            if (this.#nameIndex.has(name)) {
                // Production log: warning about name collision
                console.warn(`[WidgetRegistry] Collision detected for "${name}". Multiple paths found. Use full path to resolve.`)
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
        // Resolve the internal path key: We check if the identifier is already a full path, otherwise look it up in
        // the name index
        const resolvedPath = this.#modules[identifier] ? identifier : this.#nameIndex.get(identifier)
        const importFn = this.#modules[resolvedPath]

        if (!importFn) {
            console.error(`[WidgetRegistry] Component not found: "${identifier}"`)
            return null
        }

        /**
         * Return a React.lazy component.
         * We add a .then() block to handle various export types (default vs named).
         */
        return lazy(() =>
                        importFn().then(module => {
                            // Standard default export
                            if (module.default) {
                                return module
                            }

                            // Named export matching the filename
                            const name = resolvedPath.split('/').pop().replace('.jsx', '')
                            if (module[name]) {
                                return {default: module[name]}
                            }

                            // Fallback to the whole module
                            return {default: module}
                        }).catch(err => {
                            console.error(`[WidgetRegistry] Critical error loading "${resolvedPath}":`, err)
                            throw err
                        }),
        )
    }

    /**
     * Check for duplicates
     * @returns {string[]} List of duplicated component names
     */
    getCollisions() {
        const names = Object.keys(this.#modules).map(p => p.split('/').pop())
        return names.filter((name, index) => names.indexOf(name) !== index)
    }
}