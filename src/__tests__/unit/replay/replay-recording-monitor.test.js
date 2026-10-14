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
 * Last modified: 2026-10-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {createReplayRecordingPerformance} from '@Core/ui/replay/ReplayRecordingPerformance'

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

    it('measures both preview copies and synchronous notifications without throttling publication', () => {
        let now = 0
        const performance = createReplayRecordingPerformance({now: () => now})
        const source = document.createElement('canvas')
        source.width = 320
        source.height = 180
        const preview = document.createElement('canvas')
        const drawImage = vi.fn(() => { now += 3 })
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({drawImage})
        startReplayRecordingMonitor({mode: 'export'})
        const disconnect = connectReplayRecordingMonitorPreview(preview)
        const listener = vi.fn(() => { now += 2 })
        const unsubscribe = subscribeReplayRecordingMonitor(listener)
        performance.start({fps: 30})
        try {
            publishReplayRecordingMonitorFrame({canvas: source, frameIndex: 0, recordingPerformance: performance})
            updateReplayRecordingMonitor({size: 256, recordingPerformance: performance})
            const report = performance.finish()
            expect(report.wallMillis).toBe(10)
            expect(report.stages.find(stage => stage.key === 'previewSnapshot')).toMatchObject({count: 1, totalMillis: 3})
            expect(report.stages.find(stage => stage.key === 'previewCopy')).toMatchObject({count: 1, totalMillis: 3})
            expect(report.stages.find(stage => stage.key === 'monitorNotification')).toMatchObject({count: 2, totalMillis: 4})
            expect(report.stages.find(stage => stage.key === 'previewPublication')).toMatchObject({count: 1, totalMillis: 8})
            expect(listener).toHaveBeenCalledTimes(2)
            expect(drawImage).toHaveBeenCalledTimes(2)
            expect(preview).toMatchObject({width: 320, height: 180})
            expect(getReplayRecordingMonitorSnapshot()).toMatchObject({frameIndex: 0, size: 256})
        }
        finally {
            unsubscribe()
            disconnect()
        }
    })

    it('publishes a stable copy of the composed canvas and export progress metadata', () => {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180

        startReplayRecordingMonitor({
            mode: 'export',
            frameCount: 10,
            videoDurationMillis: 5000,
        })
        publishReplayRecordingMonitorFrame({
            canvas,
            mode: 'export',
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
            mode: 'export',
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

        startReplayRecordingMonitor({mode: 'export'})
        frames.forEach(canvas => publishReplayRecordingMonitorFrame({canvas, mode: 'export'}))

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

    it('updates every Dry run frame without copying or retaining preview images', () => {
        const targetCanvas = document.createElement('canvas')
        const drawImage = vi.fn()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        const getPreviewContext = vi.spyOn(targetCanvas, 'getContext').mockReturnValue({drawImage})
        const frames = Array.from({length: 4}, () => document.createElement('canvas'))
        frames.forEach(canvas => {
            canvas.width = 320
            canvas.height = 180
        })

        startReplayRecordingMonitor({mode: 'dry-run', frameCount: 4})
        const started = getReplayRecordingMonitorSnapshot()
        const disconnect = connectReplayRecordingMonitorPreview(targetCanvas)

        try {
            frames.forEach((canvas, index) => {
                const published = publishReplayRecordingMonitorFrame({
                    canvas,
                    progress: (index + 1) / frames.length,
                    frameIndex: index,
                    frameCount: frames.length,
                    processedFrames: index + 1,
                })
                expect(published).toMatchObject({
                    mode: 'dry-run',
                    progress: (index + 1) / frames.length,
                    frameIndex: index,
                    processedFrames: index + 1,
                    frameCanvas: null,
                    frameVersion: started.frameVersion,
                })
            })
            expect(getContext).not.toHaveBeenCalled()
            expect(getPreviewContext).not.toHaveBeenCalled()
            expect(drawImage).not.toHaveBeenCalled()
        }
        finally {
            disconnect()
        }
    })

    it('accepts preview canvases from another window realm', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        startReplayRecordingMonitor({mode: 'export'})
        publishReplayRecordingMonitorFrame({canvas: sourceCanvas, mode: 'export'})

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
        startReplayRecordingMonitor({mode: 'export'})
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
