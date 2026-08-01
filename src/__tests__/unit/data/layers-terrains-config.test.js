/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: layers-terrains-config.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { readFileSync } from 'node:fs'
import YAML             from 'yaml'
import { describe, expect, it } from 'vitest'

const loadLayersTerrains = () => YAML.parse(readFileSync('public/layers-terrains.yaml', 'utf8'))

const indexLayersById = config => new Map(
    config.providers.flatMap(provider => provider.layers.map(layer => [layer.id, {
        ...layer,
        provider: provider.id,
    }])),
)

describe('layers-terrains configuration', () => {
    it('keeps active layer ids resolvable', () => {
        const config = loadLayersTerrains()
        const layersById = indexLayersById(config)

        for (const key of ['base', 'base3d', 'tiles3d', 'overlay', 'terrain']) {
            const layerId = config[key]
            if (!layerId) {
                continue
            }

            expect(layersById.has(layerId), `${key}: ${layerId}`).toBe(true)
        }
    })

    it('declares Re:Earth Buildings as a direct 3D Tiles overlay with an error label', () => {
        const config = loadLayersTerrains()
        const layersById = indexLayersById(config)
        const layer = layersById.get('reearth-buildings')

        expect(config).toHaveProperty('tiles3d')
        expect(layer).toMatchObject({
            provider: 'reearth',
            type:     'tiles3d',
            tiles3d:  {
                kind:                       'url',
                url:                        'https://buildings.reearth.land/tileset.json',
                errorLabel:                 'Re:Earth Buildings server error',
                errorLabelPerTileMaxHeight: 5000,
            },
        })
    })

    it('declares the IGN Plan HD layer with the supplied WMTS configuration', () => {
        const config = loadLayersTerrains()
        const layersById = indexLayersById(config)
        const layer = layersById.get('ign-plan-hd')

        expect(layer).toMatchObject({
            provider:          'ign',
            name:              'Plan HD',
            type:              'base',
            tile:              'wmts',
            url:               'https://data.geopf.fr/wmts',
            layer:             'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
            style:             'normal',
            format:            'image/png',
            tileMatrixSetID:   'PM',
            minimumLevel:      0,
            maximumLevel:      19,
            countries:         [ 'FR' ],
        })
    })

    it('declares the IGN LiDAR HD terrain and above-ground plans', () => {
        const config = loadLayersTerrains()
        const layersById = indexLayersById(config)

        expect(layersById.get('ign-plan-lidar-terrain')).toMatchObject({
            provider:        'ign',
            name:            'Plan LiDAR HD - Terrain',
            type:            'base',
            tile:            'wmts',
            url:             'https://data.geopf.fr/wmts',
            layer:           'PLANIGN.LIDAR.TERRAIN',
            style:           'normal',
            format:          'image/png',
            tileMatrixSetID: 'PM_6_18',
            minimumLevel:    6,
            maximumLevel:    18,
        })

        expect(layersById.get('ign-plan-lidar-sursol')).toMatchObject({
            provider:        'ign',
            name:            'Plan LiDAR HD - Sursol',
            type:            'base',
            tile:            'wmts',
            url:             'https://data.geopf.fr/wmts',
            layer:           'PLANIGN.LIDAR.SURSOL',
            style:           'normal',
            format:          'image/png',
            tileMatrixSetID: 'PM_6_18',
            minimumLevel:    6,
            maximumLevel:    18,
        })
    })
})
