/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: layer-selection.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { applyLayerSelection } from '@Components/Settings/layers/layerSelection'
import { BASE3D_ENTITY, BASE_ENTITY, OVERLAY_ENTITY, TILES3D_ENTITY } from '@Core/constants'
import { describe, expect, it } from 'vitest'

const layer = (id, type) => ({id, type})

describe('applyLayerSelection', () => {
    it('keeps 2D overlays and 3D tiles overlays exclusive in the overlays list', () => {
        const layers = {
            overlay: 'ign-cadastral',
            tiles3d: null,
        }

        applyLayerSelection({
                                entity:         layer('reearth-buildings', TILES3D_ENTITY),
                                layersSnapshot: {...layers},
                                layersProxy:    layers,
                            })

        expect(layers.overlay).toBe('')
        expect(layers.tiles3d).toBe('reearth-buildings')

        applyLayerSelection({
                                entity:         layer('ign-cadastral', OVERLAY_ENTITY),
                                layersSnapshot: {...layers},
                                layersProxy:    layers,
                            })

        expect(layers.overlay).toBe('ign-cadastral')
        expect(layers.tiles3d).toBe('')
    })

    it('clears the competing overlay slot even when deselecting the current card', () => {
        const layers = {
            overlay: 'ign-cadastral',
            tiles3d: 'reearth-buildings',
        }

        applyLayerSelection({
                                entity:         layer('ign-cadastral', OVERLAY_ENTITY),
                                layersSnapshot: {...layers},
                                layersProxy:    layers,
                            })

        expect(layers.overlay).toBe('')
        expect(layers.tiles3d).toBe('')
    })

    it('keeps base and base3d selections exclusive', () => {
        const layers = {
            base:   'arcgis-normal',
            base3d: null,
        }

        applyLayerSelection({
                                entity:         layer('google-photorealistic', BASE3D_ENTITY),
                                layersSnapshot: {...layers},
                                layersProxy:    layers,
                            })

        expect(layers.base).toBe('')
        expect(layers.base3d).toBe('google-photorealistic')

        applyLayerSelection({
                                entity:         layer('arcgis-normal', BASE_ENTITY),
                                layersSnapshot: {...layers},
                                layersProxy:    layers,
                            })

        expect(layers.base).toBe('arcgis-normal')
        expect(layers.base3d).toBe('')
    })

    it('can force selection after a token validation without toggling off an existing layer', () => {
        const layers = {
            overlay: 'ign-cadastral',
            tiles3d: '',
        }

        applyLayerSelection({
                                entity:         layer('ign-cadastral', OVERLAY_ENTITY),
                                layersSnapshot: {...layers},
                                layersProxy:    layers,
                                forceSelect:    true,
                            })

        expect(layers.overlay).toBe('ign-cadastral')
        expect(layers.tiles3d).toBe('')
    })
})
