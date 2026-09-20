/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-draw.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

describe('TrackUtils draw scheduling', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.lgs = previousLgs
    })

    it('coalesces concurrent requests and renders the latest request after the active one', async () => {
        const source = {name: 'track#1'}
        const calls = []
        let releaseFirstDraw
        const firstDrawGate = new Promise(resolve => {
            releaseFirstDraw = resolve
        })

        globalThis.lgs = {
            viewer: {
                dataSources: {
                    contains:  value => value === source,
                    getByName: slug => slug === source.name ? [source] : [],
                },
            },
        }

        vi.spyOn(TrackUtils, 'drawOnce').mockImplementation(async (track, options) => {
            calls.push({options, track})
            if (calls.length === 1) {
                await firstDrawGate
            }
        })

        const track = {slug: source.name}
        const first = TrackUtils.draw(track, {action: 'first'})
        const second = TrackUtils.draw(track, {action: 'latest'})

        await Promise.resolve()
        expect(calls).toHaveLength(1)

        releaseFirstDraw()
        await Promise.all([first, second])

        expect(calls).toHaveLength(2)
        expect(calls[0].options).toEqual({action: 'first'})
        expect(calls[1].options).toEqual({action: 'latest'})
    })
})
