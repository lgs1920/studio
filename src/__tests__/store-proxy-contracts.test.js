/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: store-proxy-contracts.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { StoresManager }              from '@Core/stores/StoresManager'
import { editorSettings }             from '@Core/stores/editorSettings'
import { main }                       from '@Core/stores/main'
import { theJourneyEditor }           from '@Core/stores/theJourneyEditor'
import { ui }                         from '@Core/stores/ui'
import fs                             from 'node:fs'
import path                           from 'node:path'
import { fileURLToPath }              from 'node:url'
import { proxy }                      from 'valtio'
import { unstable_getInternalStates } from 'valtio/vanilla'
import { describe, expect, it }       from 'vitest'

const {proxyStateMap} = unstable_getInternalStates()
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sourceRoots = ['src/core', 'src/components', 'src/Utils']
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx'])

const isValtioProxy = value => Boolean(value && typeof value === 'object' && proxyStateMap.has(value))

const relativePath = file => path.relative(repoRoot, file).split(path.sep).join('/')

const walkSourceFiles = dir => {
    const files = []

    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (entry.name === '__tests__') {
            continue
        }

        const entryPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            files.push(...walkSourceFiles(entryPath))
            continue
        }

        if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
            files.push(entryPath)
        }
    }

    return files
}

const sourceFiles = () => sourceRoots.flatMap(root => walkSourceFiles(path.join(repoRoot, root)))

const sourceMatches = pattern => sourceFiles().flatMap(file => {
    const content = fs.readFileSync(file, 'utf8')

    return content
        .split('\n')
        .flatMap((line, index) => pattern.test(line)
                                  ? [{file: relativePath(file), line: index + 1, text: line.trim()}]
                                  : [])
})

const countByFile = matches => matches.reduce((counts, match) => {
    counts.set(match.file, (counts.get(match.file) ?? 0) + 1)
    return counts
}, new Map())

const unexpectedMatches = (matches, allowedMaxByFile) => {
    const counts = countByFile(matches)

    return Array.from(counts.entries()).flatMap(([file, count]) => {
        const allowedCount = allowedMaxByFile[file] ?? 0

        return count > allowedCount ? [`${file}: ${count} match(es), allowed ${allowedCount}`] : []
    })
}

describe('Valtio store contracts', () => {
    it('keeps StoresManager as the stable singleton access point', () => {
        const stores = new StoresManager()
        const sameStores = new StoresManager()

        expect(sameStores).toBe(stores)
        expect(sameStores.main).toBe(stores.main)
        expect(sameStores.ui).toBe(stores.ui)
        expect(sameStores.journeyEditor).toBe(stores.journeyEditor)
        expect(sameStores.editorSettings).toBe(stores.editorSettings)
    })

    it('exposes every top-level store as a Valtio proxy', () => {
        const stores = new StoresManager()

        expect(isValtioProxy(stores.main)).toBe(true)
        expect(isValtioProxy(stores.ui)).toBe(true)
        expect(isValtioProxy(stores.journeyEditor)).toBe(true)
        expect(isValtioProxy(stores.editorSettings)).toBe(true)
    })

    it('keeps historical direct proxies aligned with StoresManager identities', () => {
        const stores = new StoresManager()

        expect(proxy(main)).toBe(stores.main)
        expect(proxy(ui)).toBe(stores.ui)
        expect(proxy(theJourneyEditor)).toBe(stores.journeyEditor)
        expect(proxy(editorSettings)).toBe(stores.editorSettings)
    })

    it('documents that proxy(source) is not a reset mechanism', () => {
        const source = {journey: null}
        const firstProxy = proxy(source)

        firstProxy.journey = {slug: 'mutated'}

        expect(proxy(source)).toBe(firstProxy)
        expect(proxy(source).journey).toEqual({slug: 'mutated'})
    })

    it('keeps POI filtered maps stable when their content is recomputed', () => {
        const stores = new StoresManager()
        const pois = stores.main.components.pois
        const globalFiltered = pois.filtered.global
        const journeyFiltered = pois.filtered.journey

        pois.list.clear()
        globalFiltered.clear()
        journeyFiltered.clear()

        pois.list.set('visible-global', {visible: true, inJourney: false})
        pois.list.set('hidden-journey', {visible: false, inJourney: true})

        pois.updateFiltered()

        expect(pois.filtered.global).toBe(globalFiltered)
        expect(pois.filtered.journey).toBe(journeyFiltered)
        expect(globalFiltered.has('visible-global')).toBe(true)
        expect(globalFiltered.has('hidden-journey')).toBe(false)
        expect(journeyFiltered.has('visible-global')).toBe(false)
        expect(journeyFiltered.has('hidden-journey')).toBe(true)

        pois.list.clear()
        globalFiltered.clear()
        journeyFiltered.clear()
    })

    it('keeps the known proxyMap fields as stable proxy objects', () => {
        const stores = new StoresManager()
        const maps = [
            stores.main.components.fileLoader.fileList,
            stores.main.components.pois.list,
            stores.main.components.pois.categories,
            stores.main.components.pois.bulkList,
            stores.main.components.pois.filtered.global,
            stores.main.components.pois.filtered.journey,
            stores.main.components.pois.visibleList,
            stores.main.components.geocoder.list,
            stores.ui.mainUI.removeJourneyDialog.active,
            stores.ui.widget.list,
            stores.ui.widget.cache,
            stores.ui.widget.restrictions,
        ]

        for (const map of maps) {
            expect(isValtioProxy(map)).toBe(true)
            expect(typeof map.clear).toBe('function')
            expect(typeof map.set).toBe('function')
            expect(typeof map.get).toBe('function')
            expect(typeof map.has).toBe('function')
        }
    })
})

describe('Valtio static guardrails', () => {
    it('does not add new proxy() calls outside the reviewed allowlist', () => {
        const allowedMaxByFile = {
            'src/core/LGS1920Context.js':                         4,
            'src/core/settings/SettingsSection.js':               3,
            'src/core/stores/StoresManager.js':                   4,
            'src/Utils/ValtioUtils.js':                           2,
            'src/components/AppUpdate.jsx':                       1,
            'src/components/MainUI/CameraTarget.jsx':             1,
            'src/components/MainUI/MapPOI/MapPOIContextMenu.jsx': 1,
            'src/components/MainUI/MapPOI/MapPOIEditContent.jsx': 1,
            'src/components/MainUI/MapPOI/MapPOIEditMenu.jsx':    1,
            'src/components/MainUI/MapPOI/MapPOIListItem.jsx':    1,
            'src/components/MainUI/credits/CreditsBar.jsx':       1,
        }
        const matches = sourceMatches(/\bproxy\s*\(/)

        expect(unexpectedMatches(matches, allowedMaxByFile)).toEqual([])
    })

    it('does not add new proxyMap creations outside stores and reviewed legacy code', () => {
        const allowedMaxByFile = {
            'src/core/stores/main.js':               8,
            'src/core/stores/ui.js':                 4,
            'src/components/MainUI/MapPOI/Panel.jsx': 1,
        }
        const matches = sourceMatches(/\b(?:new\s+)?proxyMap\s*\(/)

        expect(unexpectedMatches(matches, allowedMaxByFile)).toEqual([])
    })

    it('does not add new proxyMap identity replacements', () => {
        const allowedMaxByFile = {
            'src/components/MainUI/MapPOI/Panel.jsx': 1,
        }
        const matches = sourceMatches(/\.\w+\s*=\s*new\s+proxyMap\s*\(/)

        expect(unexpectedMatches(matches, allowedMaxByFile)).toEqual([])
    })
})
