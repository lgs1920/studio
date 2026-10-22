/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-recording-performance.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-14
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {createReplayRecordingPerformance} from '@Core/ui/replay/ReplayRecordingPerformance'

describe('Replay recording performance', () => {
    it('reports nested stages separately and excludes user pauses from throughput', () => {
        let now = 0
        const performance = createReplayRecordingPerformance({now: () => now})
        performance.start({fps: 30, plannedFrameCount: 100})
        performance.configure({codec: 'avc', dimensions: {width: 1920, height: 1080}})
        now = 5
        performance.record('overlayCapture', 0)
        now = 15
        performance.record('composition', 5)
        now = 20
        performance.record('previewSnapshot', 15)
        now = 22
        performance.record('monitorNotification', 20)
        performance.record('previewPublication', 15)
        now = 72
        performance.record('pauseWait', 22)
        now = 82
        performance.record('fileSizePublication', 80)
        performance.record('encoderSubmission', 72)
        performance.frameSubmitted({timestamp: 0, duration: 0.1})
        performance.frameSubmitted({timestamp: 0.1, duration: 0.1})
        performance.frameSubmitted({keepAlive: true, timestamp: 0.000001, duration: 0.000001})
        performance.packetEncoded(100)
        performance.packetEncoded(120)
        performance.packetEncoded(5)
        now = 100
        performance.record('frameLoop', 0)

        const report = performance.finish({status: 'stopped', outputBytes: 256})
        expect(report).toMatchObject({
            status: 'stopped',
            context: {fps: 30, codec: 'avc', dimensions: {width: 1920, height: 1080}},
            frameCount: 2,
            keepAliveFrameCount: 1,
            encodedPacketCount: 3,
            encodedPacketBytes: 225,
            recordedDurationMillis: 200,
            wallMillis: 100,
            pauseMillis: 50,
            activeMillis: 50,
            frameProductionFps: 40,
            outputBytes: 256,
        })
        expect(report.stages.find(stage => stage.key === 'previewPublication')).toMatchObject({kind: 'scope', totalMillis: 7})
        expect(report.stages.find(stage => stage.key === 'previewSnapshot')).toMatchObject({kind: 'detail', totalMillis: 5})
        expect(report.stages.find(stage => stage.key === 'fileSizePublication')).toMatchObject({kind: 'detail', totalMillis: 2})
        expect(report.stages.find(stage => stage.key === 'encoderSubmission')).toMatchObject({totalMillis: 10, activeWallPercent: 20})
        expect(report.notes.join(' ')).toContain('Do not sum all rows')
        expect(JSON.parse(JSON.stringify(report))).toEqual(report)
    })

    it('aggregates long recordings without retaining per-frame timing payloads', () => {
        let now = 0
        const performance = createReplayRecordingPerformance({now: () => now})
        performance.start({fps: 60})
        for (let index = 0; index < 10000; index += 1) {
            const startedAt = now
            now += (index % 100) + 1
            performance.record('encoderCopy', startedAt)
        }
        const report = performance.finish()
        expect(report.stages).toHaveLength(1)
        expect(report.stages[0]).toMatchObject({count: 10000, totalMillis: 505000, averageMillis: 50.5, maxMillis: 100})
        expect(report.stages[0].p50Millis).toBeGreaterThanOrEqual(50)
        expect(report.stages[0].p50Millis).toBeLessThan(51)
        expect(report.stages[0].p95Millis).toBeGreaterThanOrEqual(95)
        expect(report.stages[0].p95Millis).toBeLessThan(96)
        expect(report.stages[0]).not.toHaveProperty('histogram')
        expect(report.stages[0]).not.toHaveProperty('samples')
        now += 1000
        performance.record('encoderCopy', 0)
        expect(performance.finish({status: 'failed'})).toBe(report)
        expect(report.status).toBe('completed')
    })

    it('distinguishes Replay updates, readiness waits, and scene renders inside frame work', () => {
        let now = 0
        const performance = createReplayRecordingPerformance({now: () => now})
        performance.start({routeSampleCount: 4096})
        now = 7
        performance.record('replayFrameUpdate', 0)
        now = 27
        performance.record('cesiumRender', 7)
        now = 32
        performance.record('sceneTileReadiness', 7)
        now = 42
        performance.record('frameRendering', 0)
        const report = performance.finish()

        expect(report.context.routeSampleCount).toBe(4096)
        expect(report.stages).toEqual(expect.arrayContaining([
            expect.objectContaining({key: 'frameRendering', kind: 'context', totalMillis: 42}),
            expect.objectContaining({key: 'replayFrameUpdate', kind: 'scope', totalMillis: 7}),
            expect.objectContaining({key: 'sceneTileReadiness', kind: 'scope', totalMillis: 25}),
            expect.objectContaining({key: 'cesiumRender', kind: 'detail', totalMillis: 20}),
        ]))
    })

    it('keeps partial diagnostics for an unsuccessful recording', () => {
        let now = 10
        const performance = createReplayRecordingPerformance({now: () => now})
        performance.start({label: 'broken-export'})
        now = 30
        performance.record('encoderSubmission', 10)
        const report = performance.finish({status: 'failed', error: new Error('Encoder failed')})
        expect(report).toMatchObject({
            status: 'failed', frameCount: 0, outputBytes: null,
            error: {name: 'Error', message: 'Encoder failed'},
            wallMillis: 20,
        })
        expect(report.stages[0]).toMatchObject({key: 'encoderSubmission', count: 1, totalMillis: 20})
    })
})
