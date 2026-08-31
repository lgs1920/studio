/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: layer-credits.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-18
 * Last modified: 2026-08-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it } from 'vitest'
import {
    hasLayerSpecificCredit,
    layerCreditKey,
    layerCreditText,
    resolveLayerCredit,
} from '@Core/ui/layerCredits'
import { getReportCredits } from '@Utils/ExportAsReport/credits'

afterEach(() => {
    delete globalThis.__
    delete globalThis.lgs
})

describe('layer credits', () => {
    it('detects a layer-specific attribution', () => {
        expect(hasLayerSpecificCredit({credits: 'Google Maps'})).toBe(true)
        expect(hasLayerSpecificCredit({logo: 'https://example.com/logo.png'})).toBe(true)
        expect(hasLayerSpecificCredit({credits: '   ', logo: '', url: ''})).toBe(false)
    })

    it('lets layer fields override provider fields while preserving fallback fields', () => {
        const provider = {
            id:      'cesium',
            credits: 'Cesium',
            logo:    '/cesium.svg',
            url:     'https://cesium.com',
        }
        const layer = {
            id:      'google-maps-2d-satellite',
            credits: 'Google Maps',
            url:     'https://www.google.com/maps',
        }

        const credit = resolveLayerCredit(layer, provider)

        expect(credit).toMatchObject({
            providerId:      'cesium',
            layerId:         'google-maps-2d-satellite',
            credits:         'Google Maps',
            logo:            '/cesium.svg',
            url:             'https://www.google.com/maps',
            isLayerSpecific: true,
        })
        expect(layerCreditText(credit)).toBe('Google Maps')
    })

    it('uses provider attribution when the layer has no credit override', () => {
        const credit = resolveLayerCredit({id: 'cesium-world'}, {
            id:      'cesium',
            credits: 'Cesium',
            url:     'https://cesium.com',
        })

        expect(credit).toMatchObject({
            providerId:      'cesium',
            layerId:         'cesium-world',
            credits:         'Cesium',
            isLayerSpecific: false,
        })
        expect(layerCreditKey(credit)).toContain('cesium')
    })

    it('includes a Cesium layer-specific Google Maps credit in report credits', () => {
        const googleLayer = {
            id:        'google-maps-2d-satellite',
            credits:   'Google Maps',
            logo:      '/assets/images/layers/logos/google-maps.png',
            logoText:  'Google Maps',
            url:       'https://www.google.com/maps',
        }

        globalThis.lgs = {
            settings: {
                layers: {
                    base: 'google-maps-2d-satellite',
                },
            },
        }
        globalThis.__ = {
            layersAndTerrainManager: {
                getEntityProxy: entityId => entityId === googleLayer.id ? googleLayer : null,
                getProviderProxyByEntity: entityId => entityId === googleLayer.id ? {id: 'cesium'} : null,
            },
        }

        const credits = getReportCredits()
        const googleCredit = credits.find(credit => credit.text === 'Google Maps')

        expect(googleCredit).toMatchObject({
            label: 'Base Map',
            text:  'Google Maps',
            url:   'https://www.google.com/maps',
        })
        expect(googleCredit.html).toContain('/assets/images/layers/logos/google-maps.png')
    })

    it('does not use the default Esri base credit when Google 3D is active', () => {
        const googleLayer = {
            id:      'google-photorealistic-3d',
            credits: 'Google Maps',
            url:     'https://www.google.com/maps',
            type:    'base3d',
        }

        globalThis.lgs = {
            settings: {
                layers: {
                    base:   '',
                    base3d: googleLayer.id,
                },
            },
        }
        globalThis.__ = {
            layersAndTerrainManager: {
                getEntityProxy: entityId => entityId === googleLayer.id ? googleLayer : null,
                getProviderProxyByEntity: entityId => entityId === googleLayer.id ? {id: 'cesium'} : null,
            },
        }

        const credits = getReportCredits()

        expect(credits.some(credit => credit.text === 'Esri')).toBe(false)
        expect(credits).toContainEqual(expect.objectContaining({
            label: 'Base 3D',
            text:  'Google Maps',
        }))
    })
})
