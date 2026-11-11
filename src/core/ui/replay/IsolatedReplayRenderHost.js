/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IsolatedReplayRenderHost.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Isolated Cesium render host for deterministic Replay export frames.
 */

import {
    CustomDataSource, DirectionalLight, GeoJsonDataSource, ImageryLayer, JulianDate, SkyAtmosphere, SkyBox, SunLight,
    Viewer,
} from 'cesium'

import {IonLayerUtils} from '@Utils/cesium/IonLayerUtils'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {applyReplayCesiumCameraCommand} from './ReplayCesiumCameraAdapter'
import {replayCameraCommandFromIntent} from './ReplayCameraCommand'
import {
    applyReplayImageryLayerDescriptor,
    captureReplaySceneDescriptor,
} from './ReplaySceneDescriptor'
import {createReplayCropFrustum} from './ReplayCropFrustum'
import {createReplaySceneTileReadinessCoordinator} from './ReplaySceneTileReadiness'

/**
 * Normalize physical output dimensions for one isolated host.
 *
 * @param {Object|null} dimensions - Requested output dimensions.
 * @returns {Object} Positive integer dimensions.
 */
const normalizeReplayHostDimensions = dimensions => ({
    width: Math.max(1, Math.trunc(Number(dimensions?.width) || 1920)),
    height: Math.max(1, Math.trunc(Number(dimensions?.height) || 1080)),
})

/**
 * Normalize the logical viewport while preserving fractional CSS dimensions.
 *
 * @param {Object|null} dimensions - Requested logical viewport dimensions.
 * @returns {Object} Positive viewport dimensions.
 */
const normalizeReplayHostViewportDimensions = dimensions => ({
    width: Math.max(1, Number(dimensions?.width) || 1920),
    height: Math.max(1, Number(dimensions?.height) || 1080),
})

/**
 * Normalize the export-specific screen-space error target.
 *
 * @param {number|null} value - Requested maximum screen-space error.
 * @returns {number} Positive screen-space error target.
 */
const normalizeReplayHostScreenSpaceError = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 16
}

/**
 * Verify that the isolated Cesium canvas matches its physical output dimensions.
 *
 * @param {HTMLCanvasElement} canvas - Isolated Cesium canvas.
 * @param {Object} dimensions - Requested physical dimensions.
 * @returns {Object} Actual dimensions and observable WebGL limits.
 * @throws {Error} When the browser or GPU cannot produce the requested canvas.
 */
const verifyReplayHostCanvasDimensions = (canvas, scene, dimensions) => {
    const actual = {
        width: Number(scene?.drawingBufferWidth ?? canvas?.width) || 0,
        height: Number(scene?.drawingBufferHeight ?? canvas?.height) || 0,
    }
    if (actual.width !== dimensions.width || actual.height !== dimensions.height) {
        throw new Error(
            `Native Replay rendering requested ${dimensions.width} × ${dimensions.height} pixels, `
            + `but Cesium created ${actual.width} × ${actual.height}. The export was stopped without upscaling.`,
        )
    }

    const context = canvas?.getContext?.('webgl2') ?? canvas?.getContext?.('webgl') ?? null
    const limits = context
        ? {
            maxRenderbufferSize: context.getParameter(context.MAX_RENDERBUFFER_SIZE),
            maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE),
            maxViewportDimensions: Array.from(context.getParameter(context.MAX_VIEWPORT_DIMS) ?? []),
        }
        : null
    const maximumDimension = Math.min(
        Number(limits?.maxRenderbufferSize) || Infinity,
        Number(limits?.maxTextureSize) || Infinity,
        ...((limits?.maxViewportDimensions?.length === 2) ? limits.maxViewportDimensions.map(Number) : [Infinity]),
    )
    if (dimensions.width > maximumDimension || dimensions.height > maximumDimension) {
        throw new Error(
            `Native Replay rendering requested ${dimensions.width} × ${dimensions.height} pixels, `
            + `which exceeds this browser/GPU's observed ${maximumDimension}px render limit.`,
        )
    }

    return {actual, limits}
}

/**
 * Create the off-screen DOM container owned by an isolated render host.
 *
 * @param {Object} dimensions - Physical host dimensions.
 * @returns {HTMLElement} Attached off-screen container.
 */
const createReplayHostContainer = dimensions => {
    const container = globalThis.document?.createElement?.('div')
    if (!container) {
        throw new Error('An isolated Replay render host requires a DOM document')
    }

    container.dataset.replayRenderHost = 'isolated'
    container.setAttribute('aria-hidden', 'true')
    container.style.position = 'fixed'
    container.style.left = '-100000px'
    container.style.top = '0'
    container.style.width = `${dimensions.width}px`
    container.style.height = `${dimensions.height}px`
    container.style.pointerEvents = 'none'
    container.style.overflow = 'hidden'
    globalThis.document.body?.append?.(container)
    return container
}

/**
 * Copy visual environment settings from a captured scene descriptor.
 *
 * @param {Object|null} scene - Destination Cesium scene.
 * @param {Object|null} descriptor - Captured scene descriptor.
 * @returns {void}
 */
const applyReplayHostEnvironment = (scene, descriptor) => {
    const environment = descriptor?.environment ?? {}
    if (!scene) {
        return
    }

    scene.shadows = environment.shadows === true
    if (environment.backgroundColor) {
        scene.backgroundColor = environment.backgroundColor.clone?.() ?? environment.backgroundColor
    }
    if (scene.globe) {
        Object.entries(environment.globe ?? {}).forEach(([property, value]) => {
            if (property in scene.globe) {
                scene.globe[property] = value?.clone?.() ?? value
            }
        })
    }
    if (scene.fog) {
        Object.entries(environment.fog ?? {}).forEach(([property, value]) => {
            if (property in scene.fog) {
                scene.fog[property] = value?.clone?.() ?? value
            }
        })
    }
    if (environment.skyAtmosphere) {
        scene.skyAtmosphere ??= new SkyAtmosphere()
        if (scene.skyAtmosphere) {
            Object.entries(environment.skyAtmosphere).forEach(([property, value]) => {
                if (property in scene.skyAtmosphere) {
                    scene.skyAtmosphere[property] = value?.clone?.() ?? value
                }
            })
        }
    }
    if (environment.skyBox?.sources && scene.skyBox) {
        scene.skyBox.destroy?.()
        scene.skyBox = new SkyBox({
            sources: {...environment.skyBox.sources},
            show: environment.skyBox.show,
        })
    }
    else if (environment.skyBox?.sources) {
        scene.skyBox = new SkyBox({
            sources: {...environment.skyBox.sources},
            show: environment.skyBox.show,
        })
    }
    else if (environment.skyBox === null && scene.skyBox) {
        scene.skyBox.show = false
    }
    if (environment.light?.type === 'SunLight') {
        scene.light = new SunLight({
            color: environment.light.color?.clone?.() ?? environment.light.color ?? undefined,
            intensity: environment.light.intensity ?? undefined,
        })
    }
    else if (environment.light?.type === 'DirectionalLight') {
        scene.light = new DirectionalLight({
            direction: environment.light.direction?.clone?.() ?? environment.light.direction,
            color: environment.light.color?.clone?.() ?? environment.light.color ?? undefined,
            intensity: environment.light.intensity ?? undefined,
        })
    }
    scene.verticalExaggeration = environment.verticalExaggeration ?? 1
    scene.verticalExaggerationRelativeHeight = environment.verticalExaggerationRelativeHeight ?? 0
}

/**
 * Own a hidden Cesium Viewer with no default render loop or interactive camera.
 */
export class IsolatedReplayRenderHost {
    #dimensions
    #viewportDimensions
    #descriptor
    #container
    #ownsContainer
    #widget = null
    #readinessCoordinator = null
    #readiness
    #createWidget
    #createImageryLayer
    #createTileset
    #createDataSource
    #loadTrackDataSource
    #drawPOI
    #maximumScreenSpaceError
    #createReadinessCoordinator
    #cropProjection
    #poiPixelScale
    #canvasDimensions = null
    #destroyed = false
    #contextLostError = null
    #contextLossPromise = null
    #resolveContextLoss = null
    #contextLossListener = null

    /**
     * Create an isolated render host without allocating Cesium resources yet.
     *
     * @param {Object} options - Host dimensions, scene descriptor, and factories.
     */
    constructor({
        dimensions = null,
        viewportDimensions = dimensions,
        descriptor = captureReplaySceneDescriptor(),
        container = null,
        readiness = {},
        maximumScreenSpaceError = 16,
        poiPixelScale = null,
        createWidget = (element, options) => new Viewer(element, {
            ...options,
            animation: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            navigationHelpButton: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            vrButton: false,
        }),
        createImageryLayer = provider => new ImageryLayer(provider),
        createTileset = (definition, options) => IonLayerUtils.createTileset(definition, options),
        createDataSource = name => new CustomDataSource(name),
        loadTrackDataSource = async (track, options) => {
            const dataSource = new GeoJsonDataSource(track.slug)
            await dataSource.load(track.content, options)
            return dataSource
        },
        drawPOI = (poi, options) => POIUtils.draw(poi, true, options),
        createReadinessCoordinator = createReplaySceneTileReadinessCoordinator,
        cropProjection = null,
    } = {}) {
        this.#dimensions = normalizeReplayHostDimensions(dimensions)
        this.#viewportDimensions = normalizeReplayHostViewportDimensions(viewportDimensions)
        this.#descriptor = descriptor
        this.#container = container
        this.#ownsContainer = !container
        this.#readiness = readiness
        this.#maximumScreenSpaceError = normalizeReplayHostScreenSpaceError(maximumScreenSpaceError)
        this.#createWidget = createWidget
        this.#createImageryLayer = createImageryLayer
        this.#createTileset = createTileset
        this.#createDataSource = createDataSource
        this.#loadTrackDataSource = loadTrackDataSource
        this.#drawPOI = drawPOI
        this.#createReadinessCoordinator = createReadinessCoordinator
        this.#cropProjection = cropProjection
        this.#poiPixelScale = Number.isFinite(Number(poiPixelScale)) && Number(poiPixelScale) > 0
            ? Number(poiPixelScale)
            : null
    }

    /**
     * Apply the exact crop projection to the isolated camera.
     *
     * @returns {Object|null} Applied Cesium frustum.
     */
    #applyCropFrustum = () => {
        const camera = this.#widget?.camera
        const frustum = createReplayCropFrustum(this.#cropProjection)
        if (!camera || !frustum) {
            return null
        }

        camera.frustum = frustum
        return frustum
    }

    /**
     * Record a fatal context loss and wake any capture waiting for tile readiness.
     *
     * @returns {Error} Context-loss failure.
     */
    #recordContextLoss = statusMessage => {
        if (!this.#contextLostError) {
            this.#contextLostError = new Error(
                `The Native Replay WebGL context was lost while rendering ${this.#dimensions.width} × ${this.#dimensions.height} pixels.`
                + (statusMessage ? ` Browser status: ${statusMessage}.` : '')
                + ' The export stopped at the requested resolution. Close other GPU-heavy browser tabs or choose a lower output resolution, then retry.',
            )
            this.#resolveContextLoss?.(this.#contextLostError)
        }

        return this.#contextLostError
    }

    /**
     * Reject work once the isolated WebGL context has been lost.
     *
     * @returns {void}
     * @throws {Error} Context-loss failure.
     */
    #assertContextAvailable = () => {
        if (this.#contextLostError) {
            throw this.#contextLostError
        }

        const canvas = this.#widget?.canvas
        const context = canvas?.getContext?.('webgl2') ?? canvas?.getContext?.('webgl') ?? null
        if (context?.isContextLost?.()) {
            throw this.#recordContextLoss()
        }
    }

    /** Rebuild captured Studio POIs and visible background tracks in the owned viewer. */
    #createReplaySceneContent = async () => {
        const viewer = this.#widget
        if (!viewer) {
            return
        }
        const renderTarget = this.renderTarget()

        const poiDescriptors = this.#descriptor.poiDescriptors ?? []
        const trackDescriptors = this.#descriptor.trackDescriptors ?? []
        if ((poiDescriptors.length > 0 || trackDescriptors.length > 0) && !viewer.dataSources) {
            throw new Error('Native HQ requires a Viewer with DataSourceDisplay to reconstruct Studio POIs and tracks.')
        }
        const dataSourceNames = new Set(poiDescriptors.map(descriptor => descriptor.dataSourceName).filter(Boolean))
        for (const name of dataSourceNames) {
            if (viewer.dataSources?.getByName?.(name)?.length) {
                continue
            }
            await viewer.dataSources.add(this.#createDataSource(name))
            this.#assertContextAvailable()
        }

        for (const descriptor of poiDescriptors) {
            const entity = await this.#drawPOI(descriptor.poi, {
                renderTarget,
                skipDuplicateCleanup: true,
                effectiveVisibility: descriptor.visible === true,
                billboardOverrides: descriptor.billboard,
            })
            if (!entity) {
                throw new Error(`Native Replay could not reconstruct POI "${descriptor.poi?.id ?? 'unknown'}".`)
            }
        }

        for (const track of trackDescriptors) {
            const style = track.style ?? {}
            const dataSource = await this.#loadTrackDataSource(track, {
                clampToGround: true,
                stroke: TrackUtils.cssColor(style.color),
                strokeWidth: style.farPixelWidth,
            })
            if (!dataSource) {
                throw new Error(`Native Replay could not reconstruct visible track "${track.slug}".`)
            }

            dataSource.show = true
            const entities = dataSource.entities?.values ?? []
            entities.forEach((entity, index) => {
                const polyline = entity?.polyline
                if (!polyline) {
                    return
                }

                const positions = typeof polyline.positions?.getValue === 'function'
                    ? polyline.positions.getValue(JulianDate.now())
                    : polyline.positions
                if (style.underlay?.enabled && Array.isArray(positions)) {
                    const underlay = dataSource.entities.add({
                        id: `${track.slug}#native-hq-underlay#${index}`,
                        polyline: {
                            positions,
                            clampToGround: true,
                            material: TrackUtils.cssColor(style.underlay.color),
                            width: style.underlay.pixelWidth,
                            zIndex: 0,
                        },
                    })
                    if (underlay?.polyline) {
                        underlay.polyline.zIndex = 0
                    }
                }

                polyline.material = TrackUtils.createTrackMaterial(style)
                polyline.width = style.farPixelWidth
                polyline.clampToGround = true
                polyline.zIndex = 1
            })
            await viewer.dataSources.add(dataSource)
            this.#assertContextAvailable()
        }
    }

    /**
     * Await scene readiness while allowing WebGL context loss to fail the capture immediately.
     *
     * @param {Promise<*>} operation - Readiness operation.
     * @returns {Promise<*>} Readiness result.
     * @throws {Error} Context-loss failure.
     */
    #awaitContextSafe = async operation => {
        this.#assertContextAvailable()
        if (!this.#contextLossPromise) {
            const result = await operation
            this.#assertContextAvailable()
            return result
        }

        const result = await Promise.race([
            operation,
            this.#contextLossPromise.then(error => { throw error }),
        ])
        this.#assertContextAvailable()
        return result
    }

    /**
     * Initialize the isolated widget and clone active scene layers.
     *
     * @returns {Promise<IsolatedReplayRenderHost>} Initialized host.
     */
    initialize = async () => {
        if (this.#destroyed) {
            throw new Error('Cannot initialize a destroyed isolated Replay render host')
        }
        if (this.#widget) {
            return this
        }
        if (!this.#descriptor) {
            throw new Error('Cannot initialize the isolated Replay render host without a scene descriptor')
        }
        if (this.#descriptor.compatibilityLimitations?.length) {
            throw new Error(
                'Native HQ cannot reconstruct required visible scene content: '
                + this.#descriptor.compatibilityLimitations.join('; ')
                + '. Hide or remove the listed unsupported content, then retry or select Standard export.',
            )
        }

        this.#container ??= createReplayHostContainer(this.#dimensions)
        this.#widget = this.#createWidget(this.#container, {
            baseLayer: false,
            terrainProvider: this.#descriptor.terrainProvider ?? undefined,
            sceneMode: this.#descriptor.sceneMode,
            mapProjection: this.#descriptor.mapProjection ?? undefined,
            contextOptions: {webgl: {antialias: false}},
            msaaSamples: 1,
            useDefaultRenderLoop: false,
            useBrowserRecommendedResolution: true,
            requestRenderMode: true,
            maximumRenderTimeChange: Infinity,
            shouldAnimate: false,
            shadows: this.#descriptor.environment?.shadows === true,
        })
        if (this.#widget.canvas?.addEventListener) {
            this.#contextLossPromise = new Promise(resolve => {
                this.#resolveContextLoss = resolve
            })
            this.#contextLossListener = event => this.#recordContextLoss(event?.statusMessage)
            this.#widget.canvas.addEventListener('webglcontextlost', this.#contextLossListener)
        }
        // Keep CSS layout integral and map one CSS pixel to one requested output pixel.
        // Scaling a fractional crop-sized container can make Cesium truncate one axis.
        this.#widget.resolutionScale = 1
        if (this.#widget.scene?.screenSpaceCameraController) {
            const cameraController = this.#widget.scene.screenSpaceCameraController
            cameraController.enableInputs = false
            cameraController.enableCollisionDetection = true
            cameraController.maximumTiltAngle = Math.PI / 2
            cameraController.minimumCollisionTerrainHeight = 15000
        }

        for (const layerDescriptor of this.#descriptor.imageryLayers ?? []) {
            const layer = this.#createImageryLayer(layerDescriptor.imageryProvider)
            applyReplayImageryLayerDescriptor(layer, layerDescriptor)
            this.#widget.imageryLayers?.add?.(layer)
        }

        const tilesetDefinitions = [
            this.#descriptor.base3dDefinition,
            ...(this.#descriptor.additional3dDefinitions ?? []),
        ].filter((definition, index, definitions) => definition
            && definitions.findIndex(candidate => definition.id != null
                ? candidate?.id === definition.id
                : candidate === definition) === index)
        for (const definition of tilesetDefinitions) {
            const tileset = await this.#createTileset(definition, {
                maximumScreenSpaceError: this.#maximumScreenSpaceError,
            })
            if (this.#destroyed) {
                tileset?.destroy?.()
                throw new DOMException('Replay export host initialization was aborted', 'AbortError')
            }
            this.#assertContextAvailable()
            if (tileset && 'maximumScreenSpaceError' in tileset) {
                tileset.maximumScreenSpaceError = this.#maximumScreenSpaceError
            }
            if (tileset && definition.show === false) {
                tileset.show = false
            }
            this.#widget.scene?.primitives?.add?.(tileset)
        }

        applyReplayHostEnvironment(this.#widget.scene, this.#descriptor)
        if (this.#descriptor.base3dDefinition?.base3d?.showGlobe === false && this.#widget.scene?.globe) {
            this.#widget.scene.globe.show = false
        }
        if (this.#descriptor.base3dDefinition?.base3d?.showTerrain === false && this.#widget.scene?.globe) {
            this.#widget.scene.globe.depthTestAgainstTerrain = false
        }
        await this.#createReplaySceneContent()
        this.#widget.resize?.()
        this.#applyCropFrustum()
        this.#assertContextAvailable()
        this.#widget.render?.()
        this.#assertContextAvailable()
        this.#canvasDimensions = verifyReplayHostCanvasDimensions(this.#widget.canvas, this.#widget.scene, this.#dimensions)
        this.#readinessCoordinator = this.#createReadinessCoordinator(
            this.#widget.scene,
            {
                ...this.#readiness,
                requirePostRender: this.#readiness?.policy === 'strict',
                renderNow: () => this.#widget?.render?.(),
            },
        )
        return this
    }

    /**
     * Return the physical Cesium source canvas.
     *
     * @returns {HTMLCanvasElement|null} Isolated source canvas.
     */
    canvas = () => this.#widget?.canvas ?? null

    /**
     * Return the isolated Cesium scene.
     *
     * @returns {Object|null} Cesium scene.
     */
    scene = () => this.#widget?.scene ?? null

    /**
     * Return the viewer-like CesiumWidget owned by this host.
     *
     * @returns {Object|null} Isolated Cesium widget.
     */
    viewer = () => this.#widget ?? null

    /** Return cumulative source events observed by the owned readiness coordinator. */
    readinessMetrics = () => this.#readinessCoordinator?.getMetrics?.() ?? null

    /**
     * Return the explicit replay render target exposed by this host.
     *
     * @returns {Object|null} Replay render target, or null before initialization.
     */
    renderTarget = () => this.#widget
        ? {
            viewer: this.#widget,
            scene:  this.#widget.scene,
            canvas: this.#widget.canvas,
            outputDimensions: {
                width: this.#dimensions.width,
                height: this.#dimensions.height,
            },
            poiPixelScale: this.#poiPixelScale,
            viewportDimensions: {
                width: this.#viewportDimensions.width,
                height: this.#viewportDimensions.height,
            },
            cropProjection: this.#cropProjection,
        }
        : null

    /**
     * Apply and render one canonical replay frame without touching Studio.
     *
     * @param {Object} options - Frame intent and bounded readiness options.
     * @returns {Promise<Object>} Applied camera frame and readiness result.
     */
    renderFrame = async ({
        intent = null,
        signal = null,
        maxMillis = 5000,
        settled = false,
        speedLevel = 'normal',
    } = {}) => {
        await this.initialize()
        if (signal?.aborted || this.#destroyed) {
            throw new DOMException('Replay export frame rendering was aborted', 'AbortError')
        }

        const appliedFrame = applyReplayCesiumCameraCommand({
            camera: this.#widget.camera,
            command: replayCameraCommandFromIntent(intent),
            scene: this.#widget.scene,
        })
        if (!appliedFrame) {
            throw new Error('The Replay export frame does not contain an applicable camera command')
        }

        this.#applyCropFrustum()
        const ready = await this.#awaitContextSafe(this.#readinessCoordinator?.prepareForCapture
            ? this.#readinessCoordinator.prepareForCapture({
                maxMillis,
                signal,
                settled,
                speedLevel,
            })
            : Promise.resolve(true))
        this.#widget.render?.()
        this.#assertContextAvailable()
        return {intent, appliedFrame, ready, canvasDimensions: this.#canvasDimensions}
    }

    /**
     * Render the current isolated scene and wait for bounded capture readiness.
     *
     * @param {Object} options - Bounded readiness options.
     * @returns {Promise<boolean>} Readiness outcome.
     */
    prepareForCapture = async ({
        signal = null,
        maxMillis = 5000,
        settled = false,
        speedLevel = 'normal',
    } = {}) => {
        await this.initialize()
        if (signal?.aborted || this.#destroyed) {
            throw new DOMException('Replay export frame preparation was aborted', 'AbortError')
        }

        this.#applyCropFrustum()
        const ready = await this.#awaitContextSafe(this.#readinessCoordinator?.prepareForCapture
            ? this.#readinessCoordinator.prepareForCapture({
                maxMillis,
                signal,
                settled,
                speedLevel,
            })
            : Promise.resolve(true))
        this.#widget.render?.()
        this.#assertContextAvailable()
        return ready
    }

    /**
     * Destroy Cesium resources and remove the owned off-screen container.
     *
     * @returns {void}
     */
    destroy = () => {
        if (this.#destroyed) {
            return
        }

        this.#destroyed = true
        if (this.#contextLossListener) {
            this.#widget?.canvas?.removeEventListener?.('webglcontextlost', this.#contextLossListener)
        }
        this.#contextLossListener = null
        this.#contextLossPromise = null
        this.#resolveContextLoss = null
        this.#readinessCoordinator?.dispose?.()
        this.#readinessCoordinator = null
        let destroyError = null
        const widget = this.#widget
        try {
            if (widget && widget.isDestroyed?.() !== true) {
                widget.destroy?.()
            }
        }
        catch (error) {
            destroyError = error
            try {
                const context = widget?.canvas?.getContext?.('webgl2')
                    ?? widget?.canvas?.getContext?.('webgl')
                context?.getExtension?.('WEBGL_lose_context')?.loseContext?.()
            }
            catch {
                // DOM removal still releases the isolated canvas when WebGL teardown has failed.
            }
        }
        finally {
            this.#widget = null
            if (this.#ownsContainer) {
                this.#container?.remove?.()
            }
            this.#container = null
        }
        if (destroyError) {
            throw destroyError
        }
    }
}
