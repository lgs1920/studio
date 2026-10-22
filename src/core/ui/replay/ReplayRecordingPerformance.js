/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayRecordingPerformance.js
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

/**
 * Recording-stage definitions. Detail rows overlap their enclosing operations.
 */
const STAGES = {
    codecSetup: ['Codec configuration', 'scope'],
    outputSetup: ['Output initialization', 'scope'],
    compositionSetup: ['Composition canvas initialization', 'scope'],
    frameResolution: ['Frame sample / intent resolution', 'scope'],
    frameRendering: ['Whole frame rendering (before encoding)', 'context'],
    replayFrameUpdate: ['Replay camera / trace update', 'scope'],
    sceneTileReadiness: ['Scene tile readiness / render wait', 'scope'],
    cesiumRender: ['Cesium synchronous scene render', 'detail'],
    widgetStatePublication: ['Widget frame publication / synchronous commit', 'scope'],
    overlayCapture: ['Widget canvas capture / wait', 'scope'],
    overlayLayout: ['Overlay discovery and layout', 'scope'],
    sourceLayout: ['Composition source layout', 'scope'],
    composition: ['Canvas composition (Cesium excluded)', 'scope'],
    compositionBlur: ['Composition backdrop blur', 'detail'],
    compositionTransfer: ['Composed frame transfer', 'scope'],
    previewPublication: ['Monitor frame publication', 'scope'],
    previewSnapshot: ['Monitor stable-frame copy', 'detail'],
    previewCopy: ['Monitor visible-preview copy', 'detail'],
    monitorNotification: ['Synchronous monitor notification', 'detail'],
    encoderCopy: ['Encoder stable-canvas copy', 'scope'],
    encoderQueueWait: ['Encoder submission queue wait', 'scope'],
    encoderSubmission: ['CanvasSource.add / backpressure wait', 'scope'],
    encoderKeepAliveQueue: ['Keep-alive queue wait', 'detail'],
    encoderKeepAliveSubmission: ['Keep-alive submission / wait', 'detail'],
    progressPublication: ['Frame progress publication', 'scope'],
    fileSizePublication: ['File-size publication', 'detail'],
    encoderDrain: ['Encoder close / drain', 'scope'],
    containerFinalize: ['MP4 container finalization', 'scope'],
    blobCreation: ['Output Blob creation', 'scope'],
    pauseWait: ['User pause wait', 'context'],
    frameLoop: ['Whole frame loop (includes upstream rendering)', 'context'],
    cancellationCleanup: ['Cancelled / failed output cleanup', 'context'],
}

const HISTOGRAM_SIZE = 2048
const HISTOGRAM_SCALE = 100

/** Read the browser's monotonic clock, falling back to wall-clock time. */
const defaultNow = () => globalThis.performance?.now?.() ?? Date.now()

/** Round diagnostic values without retaining unnecessary decimal precision. */
const rounded = value => Math.round(value * 1000) / 1000

/**
 * Estimate a percentile from fixed logarithmic buckets rather than retain frames.
 * Bucket upper bounds have about 1% precision in (1 + durationMillis).
 */
const percentile = (stage, fraction) => {
    const target = Math.max(1, Math.ceil(stage.count * fraction))
    let cumulative = 0
    for (let index = 0; index < stage.histogram.length; index += 1) {
        cumulative += stage.histogram[index]
        if (cumulative >= target) {
            return Math.min(stage.maxMillis, Math.expm1(index / HISTOGRAM_SCALE))
        }
    }
    return stage.maxMillis
}

/**
 * Create bounded, session-local diagnostics for real MP4 recording.
 * Timings measure wall-clock spans and command submission, not GPU completion
 * or isolated codec CPU time. No timers, frame payloads, or listeners are retained.
 *
 * @param {Object} options - Optional clock for deterministic timing tests.
 * @param {Function} [options.now] - Clock returning milliseconds.
 * @returns {Object} Recording timing collector.
 */
export const createReplayRecordingPerformance = ({now = defaultNow} = {}) => {
    const stages = new Map()
    let startedAt = null
    let metadata = {}
    let report = null
    let frameCount = 0
    let keepAliveFrameCount = 0
    let encodedPacketCount = 0
    let encodedPacketBytes = 0
    let recordedDurationMillis = 0

    /** Record one elapsed span, including spans that end in cancellation or error. */
    const record = (key, spanStartedAt) => {
        if (report || !STAGES[key] || !Number.isFinite(spanStartedAt)) {
            return
        }
        const millis = Math.max(0, now() - spanStartedAt)
        if (!Number.isFinite(millis)) {
            return
        }
        let stage = stages.get(key)
        if (!stage) {
            stage = {count: 0, totalMillis: 0, maxMillis: 0, histogram: new Uint32Array(HISTOGRAM_SIZE)}
            stages.set(key, stage)
        }
        stage.count += 1
        stage.totalMillis += millis
        stage.maxMillis = Math.max(stage.maxMillis, millis)
        const bucket = Math.min(HISTOGRAM_SIZE - 1, Math.ceil(Math.log1p(millis) * HISTOGRAM_SCALE))
        stage.histogram[bucket] += 1
    }

    /** Start the measured encoding session after scene preparation. */
    const start = context => {
        startedAt ??= now()
        metadata = {...metadata, ...context}
    }

    /** Enrich the report with the selected encoder and output characteristics. */
    const configure = context => {
        if (report) {
            return
        }
        metadata = {...metadata, ...context}
    }

    /** Count successfully submitted timeline frames separately from keep-alives. */
    const frameSubmitted = ({keepAlive = false, timestamp = 0, duration = 0} = {}) => {
        if (report) {
            return
        }
        if (keepAlive) {
            keepAliveFrameCount += 1
        }
        else {
            frameCount += 1
            recordedDurationMillis = Math.max(recordedDurationMillis, (timestamp + duration) * 1000)
        }
    }

    /** Count encoded packets without publishing per-packet diagnostic messages. */
    const packetEncoded = bytes => {
        if (report) {
            return
        }
        encodedPacketCount += 1
        encodedPacketBytes += Math.max(0, Number(bytes) || 0)
    }

    /** Freeze one serializable report for success, early stop, cancellation, or error. */
    const finish = ({status = 'completed', outputBytes = null, error = null} = {}) => {
        if (report) {
            return report
        }
        const wallMillis = Math.max(0, now() - (startedAt ?? now()))
        const pauseMillis = stages.get('pauseWait')?.totalMillis ?? 0
        const activeMillis = Math.max(0, wallMillis - pauseMillis)
        const frameLoopMillis = stages.get('frameLoop')?.totalMillis ?? 0
        const activeFrameLoopMillis = Math.max(0, frameLoopMillis - pauseMillis)
        report = {
            version: 1,
            status,
            context: metadata,
            frameCount,
            keepAliveFrameCount,
            encodedPacketCount,
            encodedPacketBytes,
            recordedDurationMillis: rounded(recordedDurationMillis),
            outputBytes,
            wallMillis: rounded(wallMillis),
            pauseMillis: rounded(pauseMillis),
            activeMillis: rounded(activeMillis),
            frameProductionFps: activeFrameLoopMillis > 0 ? rounded(frameCount * 1000 / activeFrameLoopMillis) : null,
            error: error ? {name: error.name, message: error.message} : null,
            notes: [
                'The session starts at encoding setup. Whole-frame rendering includes Replay updates, tile readiness, scene renders, widgets, composition, and monitor publication.',
                'Scope rows identify recording operations. Detail and context rows overlap enclosing spans. Packet callbacks may overlap pending asynchronous waits. Do not sum all rows.',
                'Cesium renders overlap tile readiness or frame rendering. They measure synchronous browser calls, not isolated GPU execution.',
                'CanvasSource.add measures submission and writer/encoder backpressure. Background encoding continues until close/drain.',
                'Canvas drawing measures browser call duration, not deferred GPU completion. Composition excludes the Cesium flush callback.',
                'Monitor notifications measure synchronous listeners, not subsequent asynchronous React commits.',
                'P50/P95 are approximate histogram upper bounds. Timing storage is bounded independently of frame count.',
            ],
            stages: Object.entries(STAGES).flatMap(([key, [label, kind]]) => {
                const stage = stages.get(key)
                return stage ? [{
                    key,
                    label,
                    kind,
                    count: stage.count,
                    totalMillis: rounded(stage.totalMillis),
                    averageMillis: rounded(stage.totalMillis / stage.count),
                    p50Millis: rounded(percentile(stage, 0.5)),
                    p95Millis: rounded(percentile(stage, 0.95)),
                    maxMillis: rounded(stage.maxMillis),
                    activeWallPercent: activeMillis > 0 ? rounded(stage.totalMillis * 100 / activeMillis) : null,
                }] : []
            }),
        }
        // The report contains only aggregate numbers. Release histogram buffers immediately.
        stages.clear()
        return report
    }

    return {now, start, configure, record, frameSubmitted, packetEncoded, finish}
}
