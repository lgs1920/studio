import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withReportJourneyVisibility } from '@Utils/ExportAsReport/snapshots'

describe('report visibility restore timing', () => {
    let journeyA
    let journeyB

    beforeEach(() => {
        journeyA = {slug: 'journey-a', draw: vi.fn(async () => undefined)}
        journeyB = {slug: 'journey-b', draw: vi.fn(async () => undefined)}
        globalThis.lgs = {
            journeys: new Map([
                ['journey-a', journeyA],
                ['journey-b', journeyB],
            ]),
            theJourney: journeyA,
            scene: {
                requestRender: vi.fn(),
            },
            settings: {
                journey: {
                    hideOtherJourneys: false,
                },
                ui: {
                    flythrough: {},
                },
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    isRotating: vi.fn(() => false),
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }
        globalThis.requestAnimationFrame = vi.fn(callback => {
            callback(0)
            return 1
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete globalThis.lgs
        delete globalThis.__
        delete globalThis.requestAnimationFrame
    })

    it('keeps other journeys hidden until the caller restores visibility after download', async () => {
        const {result, restore} = await withReportJourneyVisibility(journeyA, async () => 'ok')

        expect(result).toBe('ok')
        expect(journeyA.draw).toHaveBeenCalledWith(expect.objectContaining({
            hideOtherJourneys: true,
            currentJourneySlug: 'journey-a',
        }))
        expect(journeyB.draw).toHaveBeenCalledWith(expect.objectContaining({
            hideOtherJourneys: true,
            currentJourneySlug: 'journey-a',
        }))
        expect(journeyB.draw).toHaveBeenCalledTimes(1)

        await restore()

        expect(journeyA.draw).toHaveBeenCalledWith(expect.objectContaining({
            hideOtherJourneys: false,
            currentJourneySlug: 'journey-a',
        }))
        expect(journeyB.draw).toHaveBeenCalledTimes(2)
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledTimes(2)
    })
})
