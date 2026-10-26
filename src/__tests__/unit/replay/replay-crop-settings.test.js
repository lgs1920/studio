/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-crop-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Journey} from '@Core/Journey'
import {normalizeReplayCropZone, persistJourneyReplayCrop, restoreJourneyReplayCrop} from '@Core/ui/replay/ReplayCropSettings'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

/** Build a Journey crop snapshot with a locked aspect ratio. */
const crop = (width, height, value = '16x9') => ({width, height, ratio: {value, aspectRatio: width / height, locked: true}})

describe('Journey Replay crop persistence', () => {
    beforeEach(() => {
        vi.stubGlobal('lgs', {stores: {replay: {}, ui: {video: {cropper: {}}}}})
        vi.stubGlobal('__', {app: {deepClone: object => ({...object})}})
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('retains the crop dimensions through Journey serialization and deserialization', () => {
        const journey = Journey.deserialize({object: {replay: {cropZone: crop(640, 360), basic: {duration: 12}}}, reset: true})
        const restored = Journey.deserialize({object: Journey.unproxify(journey), reset: true})
        expect(restored.replay.cropZone).toEqual(crop(640, 360))
        expect(restored.replay.basic.duration).toBe(12)
    })

    it('restores each Journey independently and gives an unconfigured Journey its own default', () => {
        const a = {slug: 'a', replay: {cropZone: crop(640, 360)}}
        const b = {slug: 'b', replay: {cropZone: crop(300, 300, '1x1')}}
        const config = {id: 'video-crop-zone', container: {getBoundingClientRect: () => ({width: 800, height: 600})}}
        restoreJourneyReplayCrop(config, a)
        expect(config.cropDimensions).toMatchObject({width: 640, height: 360})
        restoreJourneyReplayCrop(config, b)
        expect(config.cropDimensions).toMatchObject({width: 300, height: 300})
        expect(lgs.stores.ui.video.ratio).toBe('1x1')
        restoreJourneyReplayCrop(config, {slug: 'new', replay: {}})
        expect(config.cropDimensions).toMatchObject({width: 800, height: 450})
        restoreJourneyReplayCrop(config, a)
        expect(lgs.stores.replay.videoCropRect).toMatchObject({width: 640, height: 360})
        expect(b.replay.cropZone).toEqual(crop(300, 300, '1x1'))
    })

    it('fits a saved crop to a smaller viewport without overwriting its saved dimensions', () => {
        const journey = {slug: 'a', replay: {cropZone: crop(1920, 1080)}}
        const config = {id: 'video-crop-zone', container: {getBoundingClientRect: () => ({width: 800, height: 600})}}
        restoreJourneyReplayCrop(config, journey)
        expect(config.cropDimensions).toEqual({left: 0, top: 75, width: 800, height: 450})
        expect(journey.replay.cropZone).toEqual(crop(1920, 1080))
    })

    it('saves completed edits to their owner and ignores stale updates after a Journey switch', async () => {
        const journey = {slug: 'a', replay: {basic: {duration: 12}}, persistToDatabase: vi.fn(async () => undefined)}
        lgs.theJourney = journey
        const config = {id: 'video-crop-zone', replayCropJourneySlug: 'a', cropDimensions: {width: 640, height: 360}, ratio: crop(640, 360).ratio}
        expect(persistJourneyReplayCrop(config, 'drag')).toBeUndefined()
        expect(journey.replay.cropZone).toBeUndefined()
        await persistJourneyReplayCrop(config, 'end')
        expect(journey.replay.cropZone).toEqual(crop(640, 360))
        expect(journey.replay.basic.duration).toBe(12)
        expect(journey.persistToDatabase).toHaveBeenCalledOnce()
        lgs.theJourney = {slug: 'b', replay: {}}
        config.cropDimensions = {width: 800, height: 450}
        await persistJourneyReplayCrop(config, 'end')
        expect(lgs.theJourney.replay.cropZone).toBeUndefined()
        expect(journey.replay.cropZone).toEqual(crop(640, 360))
    })

    it('orders rapid edits and continues saving after a storage failure', async () => {
        let rejectFirstWrite
        let firstWriteStarted
        const started = new Promise(resolve => { firstWriteStarted = resolve })
        const firstWrite = new Promise((resolve, reject) => { rejectFirstWrite = reject })
        const journey = {slug: 'a', replay: {}, persistToDatabase: vi.fn()
            .mockImplementationOnce(() => {
                firstWriteStarted()
                return firstWrite
            })
            .mockResolvedValue(undefined)}
        lgs.theJourney = journey
        const config = {id: 'video-crop-zone', replayCropJourneySlug: 'a', cropDimensions: crop(640, 360), ratio: crop(640, 360).ratio}
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const first = persistJourneyReplayCrop(config, 'end')
        await started
        config.cropDimensions = crop(800, 450)
        const second = persistJourneyReplayCrop(config, 'end')
        expect(journey.persistToDatabase).toHaveBeenCalledOnce()
        rejectFirstWrite(new Error('Storage unavailable'))
        await Promise.all([first, second])
        expect(journey.persistToDatabase).toHaveBeenCalledTimes(2)
        expect(journey.replay.cropZone).toEqual(crop(800, 450))
        expect(consoleError).toHaveBeenCalledOnce()
    })

    it.each([null, {}, {width: 0, height: 300}, {width: Infinity, height: 300}])('rejects invalid stored crop sizes: %j', value => {
        expect(normalizeReplayCropZone(value)).toBeNull()
    })
})
