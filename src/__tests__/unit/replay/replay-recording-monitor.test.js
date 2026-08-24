import {afterEach, describe, expect, it, vi} from 'vitest'

import {
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
    })

    it('publishes the exact composed canvas and HQ progress metadata', () => {
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
            frameCanvas: canvas,
            processedFrames: 4,
            size: 2048,
            elapsedMillis: 1200,
            estimatedRemainingMillis: 3800,
            videoDurationMillis: 5000,
        })
    })

    it('notifies subscribers and clears the frame on terminal cleanup', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeReplayRecordingMonitor(listener)
        startReplayRecordingMonitor({mode: 'draft'})
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
