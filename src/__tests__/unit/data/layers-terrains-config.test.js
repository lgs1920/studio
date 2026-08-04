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

    it('keeps the IGN Plan HD layer disabled', () => {
        const config = loadLayersTerrains()
        const layersById = indexLayersById(config)

        expect(layersById.has('ign-plan-hd')).toBe(false)
    })

    it('keeps the IGN LiDAR HD plans disabled', () => {
        const config = loadLayersTerrains()
        const layersById = indexLayersById(config)

        expect(layersById.has('ign-plan-lidar-terrain')).toBe(false)
        expect(layersById.has('ign-plan-lidar-sursol')).toBe(false)
    })
})
