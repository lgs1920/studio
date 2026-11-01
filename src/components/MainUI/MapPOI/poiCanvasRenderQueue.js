/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCanvasRenderQueue.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {isReplayPOIPresentationActive} from '@Core/ui/replay/JourneyReplayPOISettings'
import {subscribe} from 'valtio'

const CAMERA_BACKGROUND_INTERVAL = 64
const CAMERA_SETTLE_GRACE = 140
const MAX_INPUT_DEFERRALS = 3
const MAX_PRIORITY_BURST = 4

/** Create a queue that prioritizes interaction work and meters rich background captures. */
export const createPOICanvasRenderQueue = (maxConcurrent = 2, dependencies = {}) => {
    const pendingRenders = new Map()
    const priorityRenders = new Map()
    const activeKeys = new Set()
    let activeRenders = 0
    let activeBackgroundRenders = 0
    let activeOverflowRenders = 0
    let nextSequence = 0
    let consecutivePrioritizedRenders = 0
    let priorityRefreshCursor = 0
    let inputDeferrals = 0
    let scheduledDrain = null
    let cameraMovingUntil = 0
    let currentScene = null
    let currentReplayStore = null
    let removeSceneSubscriptions = []
    let removeReplaySubscription = null
    let lastCameraPose = null
    const concurrencyLimit = Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1

    /** Read the active Cesium scene supplied by the application or a deterministic test. */
    const getScene = () => dependencies.getScene?.()
        ?? globalThis.lgs?.scene
        ?? globalThis.lgs?.viewer?.scene
        ?? null

    /** Read Replay state without making normal map work compete with its frame loop. */
    const getReplayStore = () => dependencies.getReplayStore?.() ?? globalThis.lgs?.stores?.replay ?? null

    /** Check whether continuous user input is waiting for the main thread. */
    const hasPendingUserInput = () => {
        try {
            return globalThis.navigator?.scheduling?.isInputPending?.({includeContinuous: true}) === true
        }
        catch {
            return false
        }
    }

    /** Check camera motion from the scene events and the application's continuous orbit. */
    const isCameraMoving = () => {
        if (dependencies.isCameraMoving) {
            return dependencies.isCameraMoving()
        }
        try {
            return globalThis.__?.ui?.cameraManager?.isRotating?.() === true
                || Date.now() < cameraMovingUntil
        }
        catch {
            return Date.now() < cameraMovingUntil
        }
    }

    /** Cancel the currently scheduled idle or timer drain. */
    const cancelScheduledDrain = () => {
        if (!scheduledDrain) {
            return
        }
        scheduledDrain.cancel()
        scheduledDrain = null
    }

    /** Compare a small camera pose snapshot to detect programmatic and user movement. */
    const readCameraPose = scene => {
        const camera = scene?.camera ?? globalThis.lgs?.camera
        const position = camera?.positionWC
        const direction = camera?.directionWC
        const up = camera?.upWC
        if (!position || !direction || !up) {
            return null
        }
        return [position.x, position.y, position.z, direction.x, direction.y, direction.z, up.x, up.y, up.z]
    }

    /** Move pending map work onto Replay's established immediate scheduling path. */
    const handleReplayUpdate = () => {
        if (isReplayPOIPresentationActive(getReplayStore())) {
            cancelScheduledDrain()
        }
        schedulePendingRenders()
    }

    /** Mark camera activity and replace a pending idle callback with paced work. */
    const markCameraMoving = () => {
        cameraMovingUntil = Date.now() + CAMERA_SETTLE_GRACE
        if (scheduledDrain?.kind === 'idle') {
            cancelScheduledDrain()
        }
        schedulePendingRenders()
    }

    /** Detach scene and Replay observers when there is no queued background work. */
    const detachObservers = () => {
        removeSceneSubscriptions.forEach(remove => remove?.())
        removeSceneSubscriptions = []
        currentScene = null
        lastCameraPose = null
        removeReplaySubscription?.()
        removeReplaySubscription = null
        currentReplayStore = null
    }

    /** Observe camera changes and Replay transitions only while background work is queued. */
    const attachObservers = () => {
        const scene = getScene()
        if (scene !== currentScene) {
            removeSceneSubscriptions.forEach(remove => remove?.())
            removeSceneSubscriptions = []
            currentScene = scene
            lastCameraPose = readCameraPose(scene)
            const camera = scene?.camera ?? globalThis.lgs?.camera
            const add = event => {
                if (typeof event?.addEventListener === 'function') {
                    const remove = event.addEventListener(markCameraMoving)
                    if (typeof remove === 'function') {
                        removeSceneSubscriptions.push(remove)
                    }
                }
            }
            add(camera?.moveStart)
            add(camera?.changed)
            if (camera?.moveEnd?.addEventListener) {
                const remove = camera.moveEnd.addEventListener(() => {
                    cameraMovingUntil = Math.max(cameraMovingUntil, Date.now() + 32)
                    schedulePendingRenders()
                })
                if (typeof remove === 'function') {
                    removeSceneSubscriptions.push(remove)
                }
            }
            if (scene?.postRender?.addEventListener) {
                const remove = scene.postRender.addEventListener(() => {
                    const nextPose = readCameraPose(scene)
                    if (nextPose && lastCameraPose
                        && nextPose.some((value, index) => value !== lastCameraPose[index])) {
                        cameraMovingUntil = Date.now() + CAMERA_SETTLE_GRACE
                    }
                    lastCameraPose = nextPose
                    if (isCameraMoving()) {
                        schedulePendingRenders()
                    }
                })
                if (typeof remove === 'function') {
                    removeSceneSubscriptions.push(remove)
                }
            }
        }

        const replayStore = getReplayStore()
        if (replayStore !== currentReplayStore) {
            removeReplaySubscription?.()
            currentReplayStore = replayStore
            removeReplaySubscription = null
            if (replayStore) {
                removeReplaySubscription = subscribe(replayStore, handleReplayUpdate, true)
            }
        }
    }

    /** Choose the highest-ranked pending background item, aging requests after each burst. */
    const selectBackgroundRender = () => {
        const pendingEntries = Array.from(pendingRenders)
        if (pendingEntries.length > 0) {
            const refreshCount = Math.min(32, pendingEntries.length)
            for (let index = 0; index < refreshCount; index++) {
                const entryIndex = (priorityRefreshCursor + index) % pendingEntries.length
                const queuedRender = pendingEntries[entryIndex][1]
                if (queuedRender.getPriority) {
                    try {
                        const score = Number(queuedRender.getPriority())
                        queuedRender.score = Number.isFinite(score) ? score : 0
                    }
                    catch {
                        queuedRender.score = 0
                    }
                }
            }
            priorityRefreshCursor = (priorityRefreshCursor + refreshCount) % pendingEntries.length
        }

        let oldestKey
        let bestKey
        let bestScore = -Infinity
        for (const [key, queuedRender] of pendingEntries) {
            if (oldestKey === undefined || queuedRender.sequence < pendingRenders.get(oldestKey).sequence) {
                oldestKey = key
            }
            const score = queuedRender.score ?? 0
            if (Number.isFinite(score) && score > bestScore) {
                bestScore = score
                bestKey = key
            }
        }

        if (consecutivePrioritizedRenders >= MAX_PRIORITY_BURST && oldestKey !== undefined) {
            consecutivePrioritizedRenders = 0
            return oldestKey
        }
        if (bestKey !== undefined && bestScore > 0) {
            consecutivePrioritizedRenders++
            return bestKey
        }
        consecutivePrioritizedRenders = 0
        return oldestKey
    }

    /** Start one render and release its queue slot on every terminal path. */
    const startRender = (queue, key, queuedRender) => {
        queue.delete(key)
        const isOverflowRender = activeRenders >= concurrencyLimit
        activeRenders++
        activeKeys.add(key)
        if (queuedRender.priority) {
            if (isOverflowRender) {
                activeOverflowRenders++
            }
        }
        else {
            activeBackgroundRenders++
        }

        Promise.resolve()
            .then(queuedRender.render)
            .catch(error => console.error('Queued POI canvas render failed:', error))
            .finally(() => {
                try {
                    queuedRender.onSettled?.()
                }
                catch (error) {
                    console.error('Queued POI canvas settlement failed:', error)
                }
                activeRenders--
                activeKeys.delete(key)
                if (queuedRender.priority && isOverflowRender) {
                    activeOverflowRenders--
                }
                if (!queuedRender.priority) {
                    activeBackgroundRenders--
                }

                if (priorityRenders.size > 0) {
                    runPendingRenders()
                }
                schedulePendingRenders()
            })
    }

    /** Keep ordinary map captures paced while preserving Replay's existing concurrency. */
    const runPendingRenders = (allowBackground = false) => {
        while (priorityRenders.size > 0) {
            let selected
            for (const [key, queuedRender] of priorityRenders) {
                if (!activeKeys.has(key)
                    && (activeRenders < concurrencyLimit
                        || (queuedRender.allowOverflow && activeOverflowRenders === 0))) {
                    selected = [key, queuedRender]
                    break
                }
            }
            if (!selected) {
                break
            }
            startRender(priorityRenders, selected[0], selected[1])
        }

        const replayActive = isReplayPOIPresentationActive(getReplayStore())
        const backgroundLimit = replayActive ? concurrencyLimit : 1
        if (!allowBackground || pendingRenders.size === 0 || activeRenders >= concurrencyLimit) {
            return
        }

        while (activeBackgroundRenders < backgroundLimit && pendingRenders.size > 0
            && activeRenders < concurrencyLimit) {
            const key = selectBackgroundRender()
            if (key === undefined || activeKeys.has(key)) {
                return
            }
            startRender(pendingRenders, key, pendingRenders.get(key))
        }
    }

    /** Schedule one background task after idle time or at a bounded cadence during camera motion. */
    const schedulePendingRenders = () => {
        const replayActive = isReplayPOIPresentationActive(getReplayStore())
        const backgroundLimit = replayActive ? concurrencyLimit : 1
        if (scheduledDrain || activeBackgroundRenders >= backgroundLimit
            || (pendingRenders.size === 0 && priorityRenders.size === 0)) {
            if (pendingRenders.size === 0 && priorityRenders.size === 0 && activeRenders === 0) {
                detachObservers()
            }
            return
        }

        if (replayActive) {
            runPendingRenders(true)
            return
        }

        attachObservers()
        const drain = allowDuringMotion => {
            scheduledDrain = null
            if (isCameraMoving() && !allowDuringMotion) {
                scheduleTimer(CAMERA_BACKGROUND_INTERVAL, () => drain(true))
                return
            }
            if (hasPendingUserInput() && inputDeferrals < MAX_INPUT_DEFERRALS) {
                inputDeferrals++
                scheduleTimer(CAMERA_BACKGROUND_INTERVAL, () => drain(allowDuringMotion || isCameraMoving()))
                return
            }
            inputDeferrals = 0
            runPendingRenders(true)
        }

        if (isCameraMoving()) {
            scheduleTimer(CAMERA_BACKGROUND_INTERVAL, () => drain(true))
            return
        }

        const requestIdle = dependencies.requestIdleCallback ?? globalThis.requestIdleCallback
        if (typeof requestIdle === 'function') {
            const idleCallbackId = requestIdle(() => drain(false))
            const cancelIdle = dependencies.cancelIdleCallback ?? globalThis.cancelIdleCallback
            scheduledDrain = {
                kind: 'idle',
                cancel: () => cancelIdle?.(idleCallbackId),
            }
            return
        }

        scheduleTimer(16, () => drain(false))
    }

    /** Schedule a timer drain while retaining its cancellation handle. */
    function scheduleTimer(delay, callback) {
        const setTimer = dependencies.setTimeout ?? globalThis.setTimeout
        const clearTimer = dependencies.clearTimeout ?? globalThis.clearTimeout
        const timerId = setTimer(callback, delay)
        scheduledDrain = {
            kind: 'timer',
            cancel: () => clearTimer(timerId),
        }
    }

    /** Enqueue a latest-wins render request for one stable POI key. */
    const enqueue = (key, render, {
        priority = false,
        allowOverflow = false,
        getPriority = null,
        onSettled = null,
        onSuperseded = null,
        onCancelled = null,
    } = {}) => {
        if (key === undefined || key === null || typeof render !== 'function') {
            return
        }

        const previousRender = priorityRenders.get(key) ?? pendingRenders.get(key)
        const isPriority = priority || previousRender?.priority === true
        const canOverflow = allowOverflow || previousRender?.allowOverflow === true
        if (previousRender) {
            try {
                previousRender.onSuperseded?.()
            }
            catch (error) {
                console.error('Queued POI canvas supersession callback failed:', error)
            }
        }
        pendingRenders.delete(key)
        priorityRenders.delete(key)
        const queuedRender = {
            render,
            priority: isPriority,
            allowOverflow: canOverflow,
            getPriority: getPriority ?? previousRender?.getPriority ?? null,
            score: previousRender?.score ?? 0,
            sequence: isReplayPOIPresentationActive(getReplayStore())
                ? nextSequence++
                : previousRender?.sequence ?? nextSequence++,
            onSettled,
            onSuperseded,
            onCancelled,
        }
        if (isPriority) {
            priorityRenders.set(key, queuedRender)
            cancelScheduledDrain()
            runPendingRenders()
        }
        else {
            pendingRenders.set(key, queuedRender)
            schedulePendingRenders()
        }
    }

    /** Cancel one queued request without interrupting an active DOM capture. */
    enqueue.cancel = key => {
        const queuedRender = priorityRenders.get(key) ?? pendingRenders.get(key)
        if (!queuedRender) {
            return false
        }
        priorityRenders.delete(key)
        pendingRenders.delete(key)
        try {
            queuedRender.onCancelled?.()
        }
        catch (error) {
            console.error('Queued POI canvas cancellation callback failed:', error)
        }
        if (queuedRender.priority) {
            runPendingRenders()
        }
        schedulePendingRenders()
        return true
    }

    /** Cancel pending scheduler callbacks and event subscriptions during teardown. */
    enqueue.destroy = () => {
        cancelScheduledDrain()
        detachObservers()
    }

    return enqueue
}
