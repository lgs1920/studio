/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: elevation-server.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-12
 * Last modified: 2026-07-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ElevationServer } from '@Core/Elevation/ElevationServer'

describe('ElevationServer', () => {
    beforeEach(() => {
        globalThis.lgs = {
            axios: {
                get: vi.fn(),
            },
        }
    })

    it('registers Re:Earth as a height server', () => {
        expect(ElevationServer.getServer(ElevationServer.REEARTH)).toEqual(expect.objectContaining({
            id:          ElevationServer.REEARTH,
            maxPerQuery: 256,
        }))
    })

    it('fetches Re:Earth heights using the ellipsoid altitude when available', async () => {
        globalThis.lgs.axios.get.mockResolvedValue({
            data: {
                results: [
                    {lon: 2.1, lat: 48.2, elevation: 120, ellipsoid: 133.5},
                    {lon: 2.2, lat: 48.3, elevation: 140, ellipsoid: 152.25},
                ],
            },
        })

        const result = await ElevationServer.fetchReEarth([
            [2.1, 48.2],
            [2.2, 48.3],
        ])

        expect(globalThis.lgs.axios.get).toHaveBeenCalledWith(
            'https://terrain.reearth.land/heights.json?points=2.1,48.2;2.2,48.3',
        )
        expect(result).toEqual({
            coordinates:  [
                [2.1, 48.2, 133.5],
                [2.2, 48.3, 152.25],
            ],
            hasElevation: true,
        })
    })

    it('falls back to orthometric height when ellipsoid is absent', async () => {
        globalThis.lgs.axios.get.mockResolvedValue({
            data: {
                results: [
                    {lon: 2.1, lat: 48.2, elevation: 120},
                ],
            },
        })

        const result = await ElevationServer.fetchReEarth([[2.1, 48.2]])

        expect(result.coordinates).toEqual([[2.1, 48.2, 120]])
    })
})
