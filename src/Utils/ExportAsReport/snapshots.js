/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: snapshots.js
 *
 ******************************************************************************/

import { SceneUtils } from '@Utils/cesium/SceneUtils'
import { getGlobalHideOtherJourneys, refreshJourneyVisibility } from '@Core/ui/JourneyVisibility'
import { snapdom } from '@zumer/snapdom'
import {
    Cartesian2,
    Cartesian3,
    HeadingPitchRange,
    Math as CesiumMath,
} from 'cesium'
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
const TRACK_STYLE_ENTITY_MARKER = '#lgs-track-style#'
const CREDITS_BAR_SNAPSHOT_TIMEOUT = 1800
const SNAPSHOT_CAMERA_TIMEOUT = 900
const SNAPSHOT_RENDER_FRAME_COUNT = 3
const SNAPSHOT_CAPTURE_FRAME_COUNT = 4
const SNAPSHOT_TRACE_STABLE_FRAME_COUNT = 2
const SNAPSHOT_TRACE_TIMEOUT = 1200
const SNAPSHOT_MIN_CAMERA_RANGE = 3500
const SNAPSHOT_CAMERA_RANGE_FACTOR = 2.8

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

export const snapshotCameraRange = boundingSphere => {
    const radius = finiteNumber(boundingSphere?.radius)
    if (radius === null || radius <= 0) {
        return SNAPSHOT_MIN_CAMERA_RANGE
    }

    return Math.max(radius * SNAPSHOT_CAMERA_RANGE_FACTOR, SNAPSHOT_MIN_CAMERA_RANGE)
}

export const getJourneySnapshotFocusContext = async (journey, trackDrawings = getJourneyTrackDrawings(journey)) => {
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
    const boundingSphere = SceneUtils.getBboxBoundingSphere(
        [bounds.west, bounds.south, bounds.east, bounds.north],
        point.height ?? 0,
    )

    return {
        point,
        boundingSphere,
        range: snapshotCameraRange(boundingSphere),
    }
}

export const focusJourneyForSnapshot = async (focusContext, {heading = 0, pitch = THREE_D_SNAPSHOT_PITCH} = {}) => {
    const scene = getCesiumScene()
    const camera = scene?.camera
    if (!camera || !focusContext?.point) {
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
        timeoutId = setTimeout(finish, SNAPSHOT_CAMERA_TIMEOUT)
        try {
            if (focusContext.boundingSphere && typeof camera.flyToBoundingSphere === 'function') {
                camera.flyToBoundingSphere(focusContext.boundingSphere, {
                    duration: 0,
                    offset:   new HeadingPitchRange(
                        CesiumMath.toRadians(heading),
                        CesiumMath.toRadians(pitch),
                        focusContext.range,
                    ),
                    complete: finish,
                    cancel:   finish,
                })
            }
            else {
                camera.setView?.({
                                     destination: Cartesian3.fromDegrees(
                                         focusContext.point.longitude,
                                         focusContext.point.latitude,
                                         focusContext.point.height ?? 0,
                                     ),
                                     orientation: {
                                         heading: CesiumMath.toRadians(heading),
                                         pitch:   CesiumMath.toRadians(pitch),
                                         roll:    0,
                                     },
                                 })
                void finish()
            }
            scene.requestRender?.()
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

export const getSnapshotTrackDataSources = trackDrawings => (trackDrawings ?? [])
    .map(({track}) => globalThis.lgs?.viewer?.dataSources?.getByName?.(track?.slug)?.[0])
    .filter(Boolean)

export const getPolylinePositions = entity => {
    const property = entity?.polyline?.positions
    const time = globalThis.lgs?.viewer?.clock?.currentTime
    const positions = typeof property?.getValue === 'function' ? property.getValue(time) : property

    return Array.isArray(positions) ? positions.filter(Boolean) : []
}

export const isSnapshotTrackEntity = entity => entity?.polyline
                                             && !`${entity?.id ?? ''}`.includes(TRACK_STYLE_ENTITY_MARKER)

export const getRenderedTrackDrawingFromDataSource = trackDrawing => {
    const source = globalThis.lgs?.viewer?.dataSources?.getByName?.(trackDrawing?.track?.slug)?.[0]
    const segments = source?.entities?.values
        ?.filter(isSnapshotTrackEntity)
        .map(entity => getPolylinePositions(entity).map(cartesian => ({cartesian})))
        .filter(segment => segment.length > 1) ?? []

    return segments.length > 0
           ? {
                   track: trackDrawing.track,
                   color: trackDrawing.color,
                   segments,
               }
           : trackDrawing
}

export const getRenderedSnapshotTrackDrawings = trackDrawings => (trackDrawings ?? [])
    .map(getRenderedTrackDrawingFromDataSource)
    .filter(item => item?.segments?.length > 0)

export const projectJourney3DTrackInfo = (trackDrawings, canvas) => {
    const scene = getCesiumScene()
    if (!scene?.cartesianToCanvasCoordinates || !canvas || (trackDrawings?.length ?? 0) === 0) {
        return null
    }

    const rect = canvas.getBoundingClientRect?.() ?? {}
    const cssWidth = rect.width || canvas.clientWidth || scene.canvas?.clientWidth || canvas.width || 0
    const cssHeight = rect.height || canvas.clientHeight || scene.canvas?.clientHeight || canvas.height || 0
    const imageWidth = canvas.width || scene.drawingBufferWidth || cssWidth
    const imageHeight = canvas.height || scene.drawingBufferHeight || cssHeight
    const scaleX = cssWidth > 0 ? imageWidth / cssWidth : 1
    const scaleY = cssHeight > 0 ? imageHeight / cssHeight : 1
    const projectedTrackDrawings = getRenderedSnapshotTrackDrawings(trackDrawings)
    const scratch = new Cartesian2()
    const project = point => {
        const cartesian = point?.cartesian
        if (cartesian) {
            const projected = scene.cartesianToCanvasCoordinates(cartesian, scratch)
            return projected ? {
                x: projected.x * scaleX,
                y: projected.y * scaleY,
            } : null
        }

        const longitude = finiteNumber(point?.longitude)
        const latitude = finiteNumber(point?.latitude)
        if (longitude === null || latitude === null) {
            return null
        }

        const projected = scene.cartesianToCanvasCoordinates(
            Cartesian3.fromDegrees(longitude, latitude, finiteNumber(point?.altitude) ?? finiteNumber(point?.height) ?? 0),
            scratch,
        )
        return projected ? {
            x: projected.x * scaleX,
            y: projected.y * scaleY,
        } : null
    }

    return getProjectedTrackInfo(projectedTrackDrawings, project)
}

export const trackDataSourceReady = source => {
    if (!source || source.isLoading === true) {
        return false
    }

    return source.show === false || source.entities?.values?.some(entity => entity.polyline)
}

export const snapshotTrackSourcesReady = trackDrawings => {
    const sources = getSnapshotTrackDataSources(trackDrawings)
    const expectedCount = trackDrawings?.length ?? 0
    return expectedCount === 0 || (sources.length >= expectedCount && sources.every(trackDataSourceReady))
}

export const waitForJourneyTraceRender = async (trackDrawings, canvas) => {
    const scene = getCesiumScene()
    if (!scene) {
        return projectJourney3DTrackInfo(trackDrawings, canvas)
    }

    scene.requestRender?.()

    return await new Promise(resolve => {
        let done = false
        let stableFrames = 0
        let timeoutId = null
        let removePostRender = null
        let latestTrackInfo = null

        const cleanup = () => {
            clearTimeout(timeoutId)
            removePostRender?.()
        }
        const finish = () => {
            if (done) {
                return
            }
            done = true
            cleanup()
            resolve(latestTrackInfo ?? projectJourney3DTrackInfo(trackDrawings, canvas))
        }
        const check = () => {
            if (done) {
                return
            }

            latestTrackInfo = projectJourney3DTrackInfo(trackDrawings, canvas)
            stableFrames = latestTrackInfo
                           && snapshotTrackSourcesReady(trackDrawings)
                           ? stableFrames + 1
                           : 0

            if (stableFrames >= SNAPSHOT_TRACE_STABLE_FRAME_COUNT) {
                finish()
                return
            }

            scene.requestRender?.()
        }

        timeoutId = setTimeout(finish, SNAPSHOT_TRACE_TIMEOUT)
        removePostRender = scene.postRender?.addEventListener?.(check)
        void waitForAnimationFrames(SNAPSHOT_RENDER_FRAME_COUNT).then(check)
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

export const withReportJourneyVisibility = async (journey, callback) => {
    const currentJourney = journey ?? globalThis.lgs?.theJourney ?? null
    const previousHideOtherJourneys = getGlobalHideOtherJourneys()

    await refreshJourneyVisibility({
        hideOtherJourneys: true,
        currentJourney,
        forceCurrentVisible: true,
    })

    try {
        return await callback?.()
    }
    finally {
        await refreshJourneyVisibility({
            hideOtherJourneys: previousHideOtherJourneys,
            currentJourney,
        })
    }
}

export const captureJourney3DMapSnapshots = async (journey, {
    trackDrawings = getJourneyTrackDrawings(journey),
    onSnapshotFlash = null,
} = {}) => {
    const canvas = getCesiumCanvas()
    if (!canvas) {
        return []
    }

    const cameraState = captureCurrentCameraState(journey)
    try {
        const creditsBarSnapshot = await captureCreditsBarSnapshot()
        await ensure3DSceneForSnapshot()
        const scene = getCesiumScene()
        const focusContext = await getJourneySnapshotFocusContext(journey, trackDrawings)
        const snapshots = []

        for (const [index, view] of THREE_D_CARDINAL_VIEWS.entries()) {
            await focusJourneyForSnapshot(focusContext, {
                heading: view.heading,
                pitch:   THREE_D_SNAPSHOT_PITCH,
            })
            scene?.requestRender?.()
            const trackInfo = await waitForJourneyTraceRender(trackDrawings, canvas)
            try {
                onSnapshotFlash?.({
                    view,
                    index,
                    total: THREE_D_CARDINAL_VIEWS.length,
                })
            }
            catch (error) {
                console.error(error)
            }
            await waitForAnimationFrames(SNAPSHOT_CAPTURE_FRAME_COUNT)

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
