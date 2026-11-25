/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-layer.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-25
 * Last modified: 2026-11-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('valtio', () => ({
    subscribe: vi.fn(() => () => {}),
    useSnapshot: value => value,
}))

vi.mock('@Utils/cesium/IonLayerUtils', () => ({
    IonLayerUtils: {
        imageryProviderFromLayer: vi.fn(),
        isIonDependentLayer: vi.fn(() => false),
    },
}))

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()

    return {
        ...actual,
        ImageryLayer: class {
            constructor(imageryProvider) {
                this.imageryProvider = imageryProvider
            }
        },
        UrlTemplateImageryProvider: class {
            constructor(options) {
                this.options = options
            }
        },
    }
})

import {MapLayer, WAYBACK} from '@Components/cesium/MapLayer'
import {BASE_ENTITY} from '@Core/constants'

/**
 * Create a minimal imagery collection for the layer mounting boundary.
 * @returns {{collection: object, layers: object[]}} Imagery collection and contents.
 */
const createImageryCollection = () => {
    const layers = []
    const collection = {
        get length() {
            return layers.length
        },
        add: vi.fn((layer, index) => {
            layers.splice(index, 0, layer)
            return layer
        }),
        contains: layer => layers.includes(layer),
        remove: vi.fn(layer => {
            const index = layers.indexOf(layer)
            if (index >= 0) {
                layers.splice(index, 1)
            }
            return index >= 0
        }),
    }

    return {collection, layers}
}

/**
 * Mount the selected 2D base with a configurable 3D globe fallback.
 * @param {boolean} showGlobe Whether the selected 3D base displays the globe.
 * @returns {object} The viewer imagery collection.
 */
const mountBaseLayer = showGlobe => {
    const {collection} = createImageryCollection()
    const records = {
        'base-2d': {
            id: 'base-2d',
            type: BASE_ENTITY,
            tile: WAYBACK,
            url: 'https://tiles.example/22869/',
        },
        'base-3d': {
            id: 'base-3d',
            base3d: {showGlobe},
        },
    }
    const manager = {getEntityProxy: id => records[id]}

    globalThis.__ = {layersAndTerrainManager: manager}
    globalThis.lgs = {
        settings: {layers: {base: 'base-2d', base3d: 'base-3d', colorSettings: null}},
        stores: {ion: {source: 'user'}, main: {theLayer: null, theLayerOverlay: null}},
        viewer: {
            isDestroyed: () => false,
            imageryLayers: collection,
            scene: {requestRender: vi.fn()},
        },
    }

    render(<MapLayer type={BASE_ENTITY}/>)
    return collection
}

describe('MapLayer', () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        delete globalThis.lgs
        delete globalThis.__
    })

    it('keeps the selected 2D base imagery beneath a visible 3D globe', () => {
        const collection = mountBaseLayer(true)

        expect(collection.add).toHaveBeenCalledOnce()
        expect(collection.add.mock.calls[0][0].imageryProvider.options.url).toBe('https://tiles.example/22869/{z}/{y}/{x}')
    })

    it('does not mount globe imagery when the selected 3D layer hides the globe', () => {
        const collection = mountBaseLayer(false)

        expect(collection.add).not.toHaveBeenCalled()
    })
})
