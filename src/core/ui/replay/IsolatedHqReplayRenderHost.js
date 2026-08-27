/**
 * Isolated Cesium render host for deterministic HQ replay frames.
 */

import {CesiumWidget, ImageryLayer} from 'cesium'

import {IonLayerUtils} from '@Utils/cesium/IonLayerUtils'
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
 * Create the off-screen DOM container owned by an isolated render host.
 *
 * @param {Object} dimensions - Physical host dimensions.
 * @returns {HTMLElement} Attached off-screen container.
 */
const createReplayHostContainer = dimensions => {
    const container = globalThis.document?.createElement?.('div')
    if (!container) {
        throw new Error('An isolated HQ replay host requires a DOM document')
    }

    container.dataset.replayRenderHost = 'hq'
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
        scene.globe.show = environment.globe?.show !== false
        scene.globe.depthTestAgainstTerrain = environment.globe?.depthTestAgainstTerrain === true
        scene.globe.enableLighting = environment.globe?.enableLighting === true
        if (environment.globe?.baseColor) {
            scene.globe.baseColor = environment.globe.baseColor.clone?.() ?? environment.globe.baseColor
        }
    }
    if (scene.fog) {
        scene.fog.enabled = environment.fog?.enabled !== false
        scene.fog.renderable = environment.fog?.renderable !== false
        if (Number.isFinite(Number(environment.fog?.density))) {
            scene.fog.density = Number(environment.fog.density)
        }
    }
}

/**
 * Own a hidden CesiumWidget with no default render loop or interactive camera.
 */
export class IsolatedHqReplayRenderHost {
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
    #createReadinessCoordinator
    #cropProjection
    #destroyed = false

    /**
     * Create an isolated HQ host without allocating Cesium resources yet.
     *
     * @param {Object} options - Host dimensions, scene descriptor, and factories.
     */
    constructor({
        dimensions = null,
        viewportDimensions = dimensions,
        descriptor = captureReplaySceneDescriptor(),
        container = null,
        readiness = {},
        createWidget = (element, options) => new CesiumWidget(element, options),
        createImageryLayer = provider => new ImageryLayer(provider),
        createTileset = definition => IonLayerUtils.createTileset(definition),
        createReadinessCoordinator = createReplaySceneTileReadinessCoordinator,
        cropProjection = null,
    } = {}) {
        this.#dimensions = normalizeReplayHostDimensions(dimensions)
        this.#viewportDimensions = normalizeReplayHostViewportDimensions(viewportDimensions)
        this.#descriptor = descriptor
        this.#container = container
        this.#ownsContainer = !container
        this.#readiness = readiness
        this.#createWidget = createWidget
        this.#createImageryLayer = createImageryLayer
        this.#createTileset = createTileset
        this.#createReadinessCoordinator = createReadinessCoordinator
        this.#cropProjection = cropProjection
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
     * Initialize the isolated widget and clone active scene layers.
     *
     * @returns {Promise<IsolatedHqReplayRenderHost>} Initialized host.
     */
    initialize = async () => {
        if (this.#destroyed) {
            throw new Error('Cannot initialize a destroyed HQ replay render host')
        }
        if (this.#widget) {
            return this
        }
        if (!this.#descriptor) {
            throw new Error('Cannot initialize an HQ replay host without a scene descriptor')
        }

        this.#container ??= createReplayHostContainer(this.#viewportDimensions)
        this.#widget = this.#createWidget(this.#container, {
            baseLayer: false,
            terrainProvider: this.#descriptor.terrainProvider ?? undefined,
            sceneMode: this.#descriptor.sceneMode,
            mapProjection: this.#descriptor.mapProjection ?? undefined,
            useDefaultRenderLoop: false,
            useBrowserRecommendedResolution: true,
            requestRenderMode: true,
            maximumRenderTimeChange: Infinity,
            shouldAnimate: false,
            shadows: this.#descriptor.environment?.shadows === true,
        })
        this.#widget.resolutionScale = Math.max(
            1,
            this.#dimensions.width / this.#viewportDimensions.width,
        )
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

        if (this.#descriptor.base3dDefinition) {
            const tileset = await this.#createTileset(this.#descriptor.base3dDefinition)
            if (this.#destroyed) {
                tileset?.destroy?.()
                throw new DOMException('HQ replay host initialization was aborted', 'AbortError')
            }
            this.#widget.scene?.primitives?.add?.(tileset)
        }

        applyReplayHostEnvironment(this.#widget.scene, this.#descriptor)
        this.#widget.resize?.()
        this.#applyCropFrustum()
        this.#widget.render?.()
        this.#readinessCoordinator = this.#createReadinessCoordinator(
            this.#widget.scene,
            this.#readiness,
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
            throw new DOMException('HQ replay frame rendering was aborted', 'AbortError')
        }

        const appliedFrame = applyReplayCesiumCameraCommand({
            camera: this.#widget.camera,
            command: replayCameraCommandFromIntent(intent),
            scene: this.#widget.scene,
        })
        if (!appliedFrame) {
            throw new Error('The HQ replay frame does not contain an applicable camera command')
        }

        this.#widget.resize?.()
        this.#applyCropFrustum()
        this.#widget.render?.()
        const ready = this.#readinessCoordinator?.prepareForCapture
            ? await this.#readinessCoordinator.prepareForCapture({
                maxMillis,
                signal,
                settled,
                speedLevel,
            })
            : true
        this.#widget.render?.()
        return {intent, appliedFrame, ready}
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
            throw new DOMException('HQ replay frame preparation was aborted', 'AbortError')
        }

        this.#widget.resize?.()
        this.#applyCropFrustum()
        this.#widget.render?.()
        const ready = this.#readinessCoordinator?.prepareForCapture
            ? await this.#readinessCoordinator.prepareForCapture({
                maxMillis,
                signal,
                settled,
                speedLevel,
            })
            : true
        this.#widget.render?.()
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
        this.#readinessCoordinator?.dispose?.()
        this.#readinessCoordinator = null
        if (this.#widget && this.#widget.isDestroyed?.() !== true) {
            this.#widget.destroy?.()
        }
        this.#widget = null
        if (this.#ownsContainer) {
            this.#container?.remove?.()
        }
        this.#container = null
    }
}
