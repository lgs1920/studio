/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CesiumInputGate.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-22
 * Last modified: 2026-10-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { subscribe } from 'valtio'

const CAMERA_INPUT_PROPERTIES = [
    'enableInputs',
    'enableTranslate',
    'enableZoom',
    'enableRotate',
    'enableTilt',
    'enableLook',
]
const REPLAY_CROP_ZONE_INPUT_SHIELD_CLASS = 'replay-crop-zone-input-shield'

/**
 * Returns the runtime state that controls access to Cesium input.
 *
 * Active Replay playback and synchronized Replay export block Cesium.
 * Video preparation and Replay export without the sync link leave scene
 * and camera input available.
 *
 * @returns {{preRecording: boolean, exporting: boolean, recordingSync: boolean, replayPlaybackActive: boolean, blocked: boolean}} Cesium input state.
 */
export const getCesiumInputState = () => {
    const video = globalThis.lgs?.stores?.ui?.video
    const replay = globalThis.lgs?.stores?.replay
    const replayController = globalThis.__?.ui?.replay
    const exporting = video?.exporting === true
    const recordingSync = replay?.recordingSync === true
    const replayPlaybackActive = replay?.active === true
                                 || replay?.playing === true
                                 || replay?.paused === true
                                 || replay?.clipSequenceActive === true
                                 || replay?.dynamicFrameState?.active === true
                                 || replay?.dynamicFrameState?.playing === true
                                 || replay?.dynamicFrameState?.paused === true
                                 || replayController?.running === true
                                 || replayController?.playing === true
                                 || replayController?.paused === true

    return {
        preRecording: video?.preRecording === true,
        exporting,
        recordingSync,
        replayPlaybackActive,
        blocked:      replayPlaybackActive || (exporting && recordingSync),
    }
}

/**
 * Returns whether Cesium scene and camera input must currently be blocked.
 *
 * @returns {boolean} True during an active Replay session or synchronized recording.
 */
export const isCesiumInputBlocked = () => getCesiumInputState().blocked

/**
 * Keeps the native Cesium camera controls synchronized with the video phase.
 */
export class CesiumInputGate {
    /** @type {Object|null} */
    #controller = null

    /** @type {Object|null} */
    #savedCameraInput = null

    /** @type {boolean} */
    #blocked = false

    /** @type {Array<Function>} */
    #cleanups = []

    /**
     * Creates a gate for a Cesium viewer and subscribes to the runtime video state.
     *
     * @param {Viewer} viewer - Cesium viewer whose user camera controls are managed.
     */
    constructor(viewer) {
        this.#controller = viewer?.scene?.screenSpaceCameraController ?? null
        this.#subscribe(globalThis.lgs?.stores?.ui?.video)
        this.#subscribe(globalThis.lgs?.stores?.replay)
        this.sync()
    }

    /**
     * Subscribes to a Valtio proxy when available.
     *
     * @param {Object|null|undefined} state - Runtime state proxy.
     * @returns {void}
     * @private
     */
    #subscribe = state => {
        if (!state) {
            return
        }

        try {
            const cleanup = subscribe(state, this.sync, true)
            this.#cleanups.push(cleanup)
        }
        catch {
            // Plain state objects used by isolated consumers are synchronized lazily.
        }
    }

    /**
     * Captures the current native camera input configuration.
     *
     * @returns {Object|null} Camera input configuration or null without a controller.
     * @private
     */
    #captureCameraInput = () => {
        if (!this.#controller) {
            return null
        }

        return Object.fromEntries(CAMERA_INPUT_PROPERTIES.map(property => [property, this.#controller[property]]))
    }

    /**
     * Applies one value to every native user camera input category.
     *
     * @param {boolean} enabled - Whether user camera input is enabled.
     * @returns {void}
     * @private
     */
    #setCameraInput = enabled => {
        if (!this.#controller) {
            return
        }

        CAMERA_INPUT_PROPERTIES.forEach(property => {
            this.#controller[property] = enabled
        })
    }

    /**
     * Restores the camera input configuration captured before Replay input was blocked.
     *
     * @returns {void}
     * @private
     */
    #restoreCameraInput = () => {
        if (!this.#controller || !this.#savedCameraInput) {
            return
        }

        CAMERA_INPUT_PROPERTIES.forEach(property => {
            this.#controller[property] = this.#savedCameraInput[property]
        })
        this.#savedCameraInput = null
    }

    /**
     * Adds or removes the transparent event shield on the defined Replay crop zone.
     *
     * @param {boolean} enabled - Whether the crop zone should intercept pointer input.
     * @returns {void}
     * @private
     */
    #setCropZoneInputShield = enabled => {
        const cropZones = globalThis.document?.querySelectorAll?.(
            '.lgs-widget-container[data-widget^="video-crop-zone"]',
        ) ?? []
        cropZones.forEach(cropZone => cropZone.classList.toggle(REPLAY_CROP_ZONE_INPUT_SHIELD_CLASS, enabled))
    }

    /**
     * Synchronizes native Cesium camera input with the current video phase.
     *
     * Reapplying disabled flags while blocked prevents camera flights from
     * reopening one input category during blocked Replay playback or recording.
     *
     * @returns {boolean} True when Cesium input is blocked.
     */
    sync = () => {
        const blocked = isCesiumInputBlocked()

        if (blocked) {
            if (!this.#blocked) {
                this.#savedCameraInput = this.#captureCameraInput()
                this.#setCropZoneInputShield(true)
            }
            this.#setCameraInput(false)
        }
        else if (this.#blocked) {
            this.#setCropZoneInputShield(false)
            this.#restoreCameraInput()
        }

        this.#blocked = blocked
        return blocked
    }

    /**
     * Returns the current gate state and synchronizes the camera controller.
     *
     * @returns {boolean} True when Cesium input is blocked.
     */
    isBlocked = () => this.sync()

    /**
     * Removes state subscriptions and restores camera input if necessary.
     *
     * @returns {void}
     */
    destroy = () => {
        this.#cleanups.forEach(cleanup => cleanup())
        this.#cleanups = []
        if (this.#blocked) {
            this.#setCropZoneInputShield(false)
            this.#restoreCameraInput()
        }
        this.#blocked = false
        this.#controller = null
    }
}
