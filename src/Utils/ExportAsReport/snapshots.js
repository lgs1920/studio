/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: snapshots.js
 *
 ******************************************************************************/

import { SceneUtils } from '@Utils/cesium/SceneUtils'
import { snapdom } from '@zumer/snapdom'
import { Cartesian2, Cartesian3 } from 'cesium'
import { canvasToDataUrl } from './assets'
import {
    CESIUM_SCENE_3D_MODE,
    MAP_SNAPSHOT_TIMEOUT,
    THREE_D_CARDINAL_VIEWS,
    THREE_D_SNAPSHOT_PITCH,
} from './constants'
import { getReportCredits } from './credits'
import { finiteNumber } from './format'
import {
    getBounds,
    getProjectedTrackInfo,
} from './geometry'
import {
    getJourneyTrackDrawings,
    getReferencePoints,
} from './journeyData'

const CREDITS_BAR_ID = 'lgs-credits-bar'
const CREDITS_BAR_SNAPSHOT_TIMEOUT = 1800

export const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

export const resolveAfter = (milliseconds, value = null) => new Promise(resolve => {
    setTimeout(() => resolve(value), milliseconds)
})

export const yieldToUI = async () => {
    if (typeof requestAnimationFrame === 'function') {
        await new Promise(resolve => requestAnimationFrame(resolve))
    }

    await wait(0)
}

export const waitForAnimationFrames = async (count = 2) => {
    if (typeof requestAnimationFrame !== 'function') {
        await wait(50)
        return
    }

    for (let index = 0; index < count; index++) {
        await new Promise(resolve => requestAnimationFrame(resolve))
    }
}

export const waitForCesiumEvent = async (event, timeout = MAP_SNAPSHOT_TIMEOUT) => {
    if (!event?.addEventListener) {
        await wait(100)
        return
    }

    await new Promise(resolve => {
        let remove = null
        let done = false
        let timeoutId = null
        const finish = () => {
            if (done) {
                return
            }
            done = true
            clearTimeout(timeoutId)
            remove?.()
            resolve()
        }
        timeoutId = setTimeout(finish, timeout)
        remove = event.addEventListener(finish)
    })
}

export const getCesiumScene = () => globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene ?? null

export const clonePlain = value => {
    if (!value) {
        return value
    }

    try {
        return JSON.parse(JSON.stringify(value))
    }
    catch {
        return null
    }
}

export const getCesiumCanvas = () => {
    const viewer = globalThis.lgs?.viewer
    return viewer?.scene?.canvas ?? viewer?.canvas ?? getCesiumScene()?.canvas ?? null
}

export const captureCurrentCameraState = journey => {
    const camera = getCesiumScene()?.camera ?? globalThis.lgs?.camera ?? null

    return {
        camera,
        position:              camera?.positionWC?.clone?.() ?? camera?.position?.clone?.() ?? null,
        direction:             camera?.directionWC?.clone?.() ?? camera?.direction?.clone?.() ?? null,
        up:                    camera?.upWC?.clone?.() ?? camera?.up?.clone?.() ?? null,
        cameraManagerSettings: clonePlain(globalThis.__?.ui?.cameraManager?.settings),
        journeyCamera:         clonePlain(journey?.camera),
    }
}

export const restoreCameraState = async (state, journey) => {
    if (!state) {
        return
    }

    try {
        if (state.camera && state.position && state.direction && state.up) {
            state.camera.cancelFlight?.()
            state.camera.setView?.({
                                      destination: state.position,
                                      orientation: {
                                          direction: state.direction,
                                          up:        state.up,
                                      },
                                  })
        }
        if (state.cameraManagerSettings && globalThis.__?.ui?.cameraManager) {
            globalThis.__.ui.cameraManager.settings = state.cameraManagerSettings
            globalThis.__.ui.cameraManager.clone?.()
        }
        if (journey && state.journeyCamera !== undefined && state.journeyCamera !== null) {
            journey.camera = state.journeyCamera
        }
        getCesiumScene()?.requestRender?.()
        await waitForAnimationFrames(2)
    }
    catch (error) {
        console.error(error)
    }
}

export const ensure3DSceneForSnapshot = async () => {
    const scene = getCesiumScene()
    if (!scene || Number(scene.mode) === CESIUM_SCENE_3D_MODE || typeof scene.morphTo3D !== 'function') {
        return
    }

    try {
        const morphComplete = waitForCesiumEvent(scene.morphComplete)
        if (globalThis.lgs?.settings?.scene?.mode) {
            globalThis.lgs.settings.scene.mode.value = CESIUM_SCENE_3D_MODE
        }
        scene.morphTo3D(0)
        await morphComplete
    }
    catch (error) {
        console.error(error)
    }
}

export const getJourneySnapshotFocusContext = async journey => {
    const trackDrawings = getJourneyTrackDrawings(journey)
    const referencePoints = getReferencePoints(trackDrawings, [], [])
    if (referencePoints.length === 0) {
        return null
    }

    const bounds = getBounds(referencePoints)
    const source = SceneUtils.getJourneyFeatureSource(journey)
    const center = await SceneUtils.getJourneyCentroid(journey, source, {useStoredHeight: false})
    const point = center ?? {
        longitude: (bounds.west + bounds.east) / 2,
        latitude:  (bounds.south + bounds.north) / 2,
        height:    0,
    }

    return {
        point,
        boundingSphere: SceneUtils.getBboxBoundingSphere(
            [bounds.west, bounds.south, bounds.east, bounds.north],
            point.height ?? 0,
        ),
    }
}

export const focusJourneyForSnapshot = async (focusContext, {heading = 0, pitch = THREE_D_SNAPSHOT_PITCH} = {}) => {
    if (!focusContext?.point) {
        await waitForAnimationFrames(2)
        return
    }

    await new Promise(resolve => {
        let done = false
        let timeoutId = null
        const finish = async () => {
            if (done) {
                return
            }
            done = true
            clearTimeout(timeoutId)
            await waitForAnimationFrames(2)
            resolve()
        }
        timeoutId = setTimeout(finish, MAP_SNAPSHOT_TIMEOUT)
        try {
            void SceneUtils.focus(focusContext.point, {
                resetCamera:         true,
                rotate:              false,
                pitch,
                heading,
                flyingTime:          0,
                boundingSphere:      focusContext.boundingSphere,
                boundingSphereRange: focusContext.boundingSphere?.radius > 0 ? 0 : undefined,
                callback:            finish,
            }).catch(error => {
                console.error(error)
                void finish()
            })
        }
        catch (error) {
            console.error(error)
            void finish()
        }
    })
}

export const captureCanvasSnapshot = async canvas => {
    const rect = canvas.getBoundingClientRect?.() ?? {}
    const width = canvas.width || Math.round(rect.width ?? 0)
    const height = canvas.height || Math.round(rect.height ?? 0)
    const dataUrl = await canvasToDataUrl(canvas)

    return dataUrl && width > 0 && height > 0 ? {dataUrl, width, height} : null
}

export const loadSnapshotImage = dataUrl => new Promise(resolve => {
    if (!dataUrl || typeof Image === 'undefined') {
        resolve(null)
        return
    }

    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = dataUrl
})

export const captureCreditsBarSnapshot = async () => {
    if (typeof document === 'undefined') {
        return null
    }

    const element = document.getElementById(CREDITS_BAR_ID) ?? document.querySelector('.credits-bar')
    const rect = element?.getBoundingClientRect?.()
    if (!element || !rect?.width || !rect?.height) {
        return null
    }

    try {
        await waitForAnimationFrames(2)
        const snapshot = await Promise.race([
                                                snapdom(element, {scale: 2}),
                                                resolveAfter(CREDITS_BAR_SNAPSHOT_TIMEOUT),
                                            ])
        if (!snapshot) {
            return null
        }

        const canvas = await Promise.race([
                                              snapshot.toCanvas(),
                                              resolveAfter(CREDITS_BAR_SNAPSHOT_TIMEOUT),
                                          ])
        if (!canvas) {
            return null
        }
        const dataUrl = await canvasToDataUrl(canvas)

        return dataUrl ? {
            dataUrl,
            width:  canvas.width,
            height: canvas.height,
            ratio:  canvas.width / Math.max(canvas.height, 1),
        } : null
    }
    catch (error) {
        console.error(error)
        return null
    }
}

export const embedCreditsBarInSnapshot = async (snapshot, creditsBar) => {
    if (!snapshot?.dataUrl || !creditsBar?.dataUrl || typeof document === 'undefined') {
        return snapshot
    }

    const [sourceImage, creditsImage] = await Promise.all([
                                                             loadSnapshotImage(snapshot.dataUrl),
                                                             loadSnapshotImage(creditsBar.dataUrl),
                                                         ])
    if (!sourceImage || !creditsImage) {
        return snapshot
    }

    const canvas = document.createElement('canvas')
    canvas.width = snapshot.width
    canvas.height = snapshot.height
    const context = canvas.getContext?.('2d')
    if (!context) {
        return snapshot
    }

    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height)

    const margin = Math.max(Math.round(canvas.width * 0.012), 10)
    const maxWidth = canvas.width * 0.48
    const maxHeight = canvas.height * 0.095
    const ratio = creditsBar.width / Math.max(creditsBar.height, 1)
    let width = Math.min(creditsBar.width / 2, maxWidth)
    let height = width / ratio
    if (height > maxHeight) {
        height = maxHeight
        width = height * ratio
    }

    context.drawImage(
        creditsImage,
        canvas.width - width - margin,
        canvas.height - height - margin,
        width,
        height,
    )

    return {
        ...snapshot,
        dataUrl: await canvasToDataUrl(canvas),
    }
}

export const projectJourney3DTrackInfo = (trackDrawings, canvas) => {
    const scene = getCesiumScene()
    if (!scene?.cartesianToCanvasCoordinates || !canvas || trackDrawings.length === 0) {
        return null
    }

    const rect = canvas.getBoundingClientRect?.() ?? {}
    const cssWidth = rect.width || canvas.clientWidth || scene.canvas?.clientWidth || canvas.width || 0
    const cssHeight = rect.height || canvas.clientHeight || scene.canvas?.clientHeight || canvas.height || 0
    const imageWidth = canvas.width || scene.drawingBufferWidth || cssWidth
    const imageHeight = canvas.height || scene.drawingBufferHeight || cssHeight
    const scaleX = cssWidth > 0 ? imageWidth / cssWidth : 1
    const scaleY = cssHeight > 0 ? imageHeight / cssHeight : 1
    const scratch = new Cartesian2()
    const project = point => {
        const longitude = finiteNumber(point?.longitude)
        const latitude = finiteNumber(point?.latitude)
        if (longitude === null || latitude === null) {
            return null
        }

        const cartesian = Cartesian3.fromDegrees(longitude, latitude, finiteNumber(point?.altitude) ?? finiteNumber(point?.height) ?? 0)
        const projected = scene.cartesianToCanvasCoordinates(cartesian, scratch)
        return projected ? {
            x: projected.x * scaleX,
            y: projected.y * scaleY,
        } : null
    }

    return getProjectedTrackInfo(trackDrawings, project)
}

export const waitForJourneyTraceRender = async (trackDrawings, canvas) => {
    const scene = getCesiumScene()
    if (!scene?.postRender?.addEventListener) {
        await waitForAnimationFrames(3)
        return projectJourney3DTrackInfo(trackDrawings, canvas)
    }

    return await new Promise(resolve => {
        let stableFrames = 0
        let lastQueueLength = null
        let done = false
        let removePostRender = null
        let removeTileProgress = null
        let timeoutId = null
        let latestTrackInfo = null
        const globe = scene.globe
        const finish = () => {
            if (done) {
                return
            }
            done = true
            clearTimeout(timeoutId)
            removePostRender?.()
            removeTileProgress?.()
            resolve(latestTrackInfo ?? projectJourney3DTrackInfo(trackDrawings, canvas))
        }
        const isTileQueueReady = queueLength => (!Number.isFinite(queueLength) || queueLength === 0) && globe?.tilesLoaded !== false
        const check = queueLength => {
            if (done) {
                return
            }
            if (Number.isFinite(queueLength)) {
                lastQueueLength = queueLength
            }

            latestTrackInfo = projectJourney3DTrackInfo(trackDrawings, canvas)
            stableFrames = latestTrackInfo && isTileQueueReady(lastQueueLength) ? stableFrames + 1 : 0
            if (stableFrames >= 3) {
                finish()
                return
            }

            scene.requestRender?.()
        }

        timeoutId = setTimeout(finish, MAP_SNAPSHOT_TIMEOUT)
        removePostRender = scene.postRender.addEventListener(() => check(lastQueueLength))
        if (globe?.tileLoadProgressEvent?.addEventListener) {
            removeTileProgress = globe.tileLoadProgressEvent.addEventListener(queueLength => check(queueLength))
        }

        scene.requestRender?.()
        void waitForAnimationFrames(1).then(() => check(lastQueueLength))
    })
}

export const currentViewerSnapshot = async () => {
    const canvas = getCesiumCanvas()
    if (!canvas) {
        return null
    }

    try {
        return await captureCanvasSnapshot(canvas)
    }
    catch (error) {
        console.error(error)
        return null
    }
}

export const captureJourney3DMapSnapshots = async journey => {
    const canvas = getCesiumCanvas()
    if (!canvas) {
        return []
    }

    const trackDrawings = getJourneyTrackDrawings(journey)
    const cameraState = captureCurrentCameraState(journey)
    try {
        const creditsBarSnapshot = await captureCreditsBarSnapshot()
        await ensure3DSceneForSnapshot()
        const scene = getCesiumScene()
        const focusContext = await getJourneySnapshotFocusContext(journey)
        const snapshots = []

        for (const view of THREE_D_CARDINAL_VIEWS) {
            await focusJourneyForSnapshot(focusContext, {
                heading: view.heading,
                pitch:   THREE_D_SNAPSHOT_PITCH,
            })
            scene?.requestRender?.()
            const trackInfo = await waitForJourneyTraceRender(trackDrawings, canvas)
            await waitForAnimationFrames(1)

            const snapshot = await captureCanvasSnapshot(canvas)
            if (snapshot) {
                const snapshotWithCredits = await embedCreditsBarInSnapshot(snapshot, creditsBarSnapshot)
                snapshots.push({
                    ...snapshotWithCredits,
                    view,
                    trackInfo,
                    credits: getReportCredits(),
                })
            }
        }

        return snapshots
    }
    catch (error) {
        console.error(error)
        return []
    }
    finally {
        await restoreCameraState(cameraState, journey)
    }
}
