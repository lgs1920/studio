/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-recording-monitor.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

import {
    connectReplayRecordingMonitorPreview,
    getReplayRecordingMonitorSnapshot,
    publishReplayRecordingMonitorFrame,
    startReplayRecordingMonitor,
    stopReplayRecordingMonitor,
    subscribeReplayRecordingMonitor,
    updateReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'

describe('ReplayRecordingMonitor', () => {
    afterEach(() => {
        stopReplayRecordingMonitor()
        vi.restoreAllMocks()
    })

    it('publishes a stable copy of the composed canvas and HQ progress metadata', () => {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180

        startReplayRecordingMonitor({
            mode: 'hq',
            frameCount: 10,
            videoDurationMillis: 5000,
        })
        publishReplayRecordingMonitorFrame({
            canvas,
            mode: 'hq',
            phase: 'rendering',
            progress: 0.4,
            frameIndex: 3,
            frameCount: 10,
            processedFrames: 4,
        })
        updateReplayRecordingMonitor({
            size: 2048,
            elapsedMillis: 1200,
            estimatedRemainingMillis: 3800,
        })

        expect(getReplayRecordingMonitorSnapshot()).toMatchObject({
            active: true,
            mode: 'hq',
            phase: 'rendering',
            progress: 0.4,
            frameCanvas: expect.any(HTMLCanvasElement),
            processedFrames: 4,
            size: 2048,
            elapsedMillis: 1200,
            estimatedRemainingMillis: 3800,
            videoDurationMillis: 5000,
        })
        expect(getReplayRecordingMonitorSnapshot().frameCanvas).not.toBe(canvas)
    })

    it('copies each composed frame synchronously and reconnects from its stable snapshot', () => {
        const targetCanvas = document.createElement('canvas')
        const drawImage = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        vi.spyOn(targetCanvas, 'getContext').mockReturnValue({drawImage})
        const disconnect = connectReplayRecordingMonitorPreview(targetCanvas)
        const frames = Array.from({length: 3}, () => document.createElement('canvas'))
        frames.forEach(canvas => {
            canvas.width = 320
            canvas.height = 180
        })

        startReplayRecordingMonitor({mode: 'hq'})
        frames.forEach(canvas => publishReplayRecordingMonitorFrame({canvas, mode: 'hq'}))

        const stableFrame = getReplayRecordingMonitorSnapshot().frameCanvas
        expect(drawImage).toHaveBeenCalled()
        expect(drawImage.mock.calls.slice(-3).map(([canvas]) => canvas)).toEqual([stableFrame, stableFrame, stableFrame])
        expect(stableFrame).not.toBe(frames[2])
        expect(targetCanvas).toMatchObject({width: 320, height: 180})

        disconnect()

        const replacementCanvas = document.createElement('canvas')
        const replacementDrawImage = vi.fn()
        vi.spyOn(replacementCanvas, 'getContext').mockReturnValue({drawImage: replacementDrawImage})
        const disconnectReplacement = connectReplayRecordingMonitorPreview(replacementCanvas)
        expect(replacementDrawImage).toHaveBeenCalledWith(stableFrame, 0, 0, 320, 180)
        disconnectReplacement()
    })

    it('accepts preview canvases from another window realm', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        startReplayRecordingMonitor({mode: 'hq'})
        publishReplayRecordingMonitorFrame({canvas: sourceCanvas, mode: 'hq'})

        const drawImage = vi.fn()
        const externalCanvas = {
            nodeName: 'CANVAS',
            width: 0,
            height: 0,
            getContext: vi.fn().mockReturnValue({drawImage}),
        }
        const disconnect = connectReplayRecordingMonitorPreview(externalCanvas)

        expect(drawImage).toHaveBeenCalledWith(
            getReplayRecordingMonitorSnapshot().frameCanvas,
            0,
            0,
            320,
            180,
        )
        expect(externalCanvas).toMatchObject({width: 320, height: 180})
        disconnect()
    })

    it('notifies subscribers and clears the frame on terminal cleanup', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeReplayRecordingMonitor(listener)
        startReplayRecordingMonitor({mode: 'hq'})
        stopReplayRecordingMonitor()
        unsubscribe()

        expect(listener).toHaveBeenCalledTimes(2)
        expect(getReplayRecordingMonitorSnapshot()).toMatchObject({
            active: false,
            frameCanvas: null,
            mode: null,
            estimatedRemainingMillis: null,
            videoDurationMillis: null,
        })
    })
})
