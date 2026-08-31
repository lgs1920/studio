/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ion-token-manager.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-24
 * Last modified: 2026-08-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { StoresManager } from '@Core/stores/StoresManager'
import { IonTokenManager } from '@Core/ui/IonTokenManager'
import * as Cesium from 'cesium'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ionUtils = vi.hoisted(() => ({
    clearCesiumCache:    vi.fn(async () => undefined),
    isIonDependentLayer: vi.fn(layer => layer?.provider === 'cesium' || layer?.tile === 'ion' || layer?.terrainType === 'cesium'),
}))

vi.mock('@Utils/cesium/IonLayerUtils', () => ({IonLayerUtils: ionUtils}))
vi.mock('@Utils/cesium/TerrainUtils', () => ({TerrainUtils: {changeTerrain: vi.fn(async () => undefined)}}))

describe('IonTokenManager', () => {
    let previousLgs

    beforeEach(() => {
        previousLgs = globalThis.lgs
        const stores = new StoresManager()
        stores.ion.token = null
        stores.ion.source = 'none'
        stores.ion.loaded = false

        globalThis.lgs = {
            stores,
            settings: {
                layers: {
                    providers: [],
                },
            },
            savedConfiguration: {
                layers: {
                    base:    'arcgis-normal',
                    terrain: 'reearth-world',
                },
            },
            db: {
                settings: {
                    delete: vi.fn(async () => undefined),
                },
                vault: {
                    delete: vi.fn(async () => undefined),
                    get:    vi.fn(async () => undefined),
                    put:    vi.fn(async () => undefined),
                },
            },
        }

        ionUtils.clearCesiumCache.mockClear()
        ionUtils.isIonDependentLayer.mockClear()
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok:   true,
            json: vi.fn(async () => ({})),
        })
    })

    afterEach(() => {
        globalThis.lgs = previousLgs
        vi.restoreAllMocks()
    })

    it('loads without a token and does not initialize Ion cache or global credentials', async () => {
        const manager = new IonTokenManager()

        await manager.load()

        expect(globalThis.lgs.stores.ion).toMatchObject({
            token:  null,
            source: 'none',
            loaded: true,
        })
        expect(ionUtils.clearCesiumCache).not.toHaveBeenCalled()
        expect(globalThis.lgs.db.settings.delete).toHaveBeenCalledWith('ion', 'settings')
    })

    it('loads a provider token without applying it to Cesium globally', async () => {
        globalThis.lgs.db.vault.get.mockResolvedValue('provider-token')
        const manager = new IonTokenManager()

        await manager.load()

        expect(globalThis.lgs.stores.ion).toMatchObject({
            token:  'provider-token',
            source: 'user',
            loaded: true,
        })
        expect(Cesium.Ion.defaultAccessToken).not.toBe('provider-token')
    })

    it('migrates legacy Ion layer credentials to the provider vault key', async () => {
        globalThis.lgs.settings.layers.providers = [{
            id:     'cesium',
            layers: [{id: 'cesium-world', provider: 'cesium', assetId: 1}],
        }]
        globalThis.lgs.db.vault.get.mockImplementation(async key => key === 'cesium-world' ? 'legacy-token' : undefined)
        const manager = new IonTokenManager()

        await manager.load()

        expect(globalThis.lgs.db.vault.put).toHaveBeenCalledWith('cesium_ion_token', 'legacy-token', 'vault')
        expect(globalThis.lgs.db.vault.delete).toHaveBeenCalledWith('cesium-world', 'vault')
        expect(globalThis.lgs.stores.ion.token).toBe('legacy-token')
    })

    it('validates and saves a provider-level token without creating the Ion cache', async () => {
        const manager = new IonTokenManager()

        await manager.save('personal-token')

        expect(globalThis.lgs.db.vault.put).toHaveBeenCalledWith('cesium_ion_token', 'personal-token', 'vault')
        expect(globalThis.lgs.stores.ion).toMatchObject({
            token:  'personal-token',
            source: 'user',
        })
        expect(ionUtils.clearCesiumCache).toHaveBeenCalledTimes(1)
    })

    it('removes the provider token and falls back from active Ion selections', async () => {
        const selectedIonLayer = {id: 'cesium-world', provider: 'cesium', terrainType: 'cesium'}
        globalThis.lgs.settings.layers.terrain = selectedIonLayer.id
        globalThis.lgs.editorSettingsProxy = {
            layer: {
                tokenDialog: true,
                tmpEntity:   selectedIonLayer,
                refreshList: false,
            },
        }
        globalThis.__ = {
            layersAndTerrainManager: {
                getEntityProxy: vi.fn(id => id === selectedIonLayer.id ? selectedIonLayer : null),
            },
        }
        const manager = new IonTokenManager()
        await manager.save('personal-token')

        await manager.clear()

        expect(globalThis.lgs.stores.ion).toMatchObject({
            token:  null,
            source: 'none',
        })
        expect(globalThis.lgs.settings.layers.terrain).toBe('reearth-world')
        expect(globalThis.lgs.editorSettingsProxy.layer).toMatchObject({
            tokenDialog: false,
            tmpEntity:   null,
            refreshList: true,
        })
    })
})
