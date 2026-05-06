/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughMode.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FlythroughCesiumRenderer } from './FlythroughCesiumRenderer'
import {
    FLYTHROUGH_EVENT_END, FLYTHROUGH_EVENT_PAUSE, FLYTHROUGH_EVENT_RESUME, FLYTHROUGH_EVENT_START, FLYTHROUGH_EVENT_STOP,
    FLYTHROUGH_EVENT_UPDATE,
    FlythroughPlaybackController,
} from './FlythroughPlaybackController'
import { FlythroughPathSampler, FLYTHROUGH_SCOPE_ALL_TRACKS } from './FlythroughPathSampler'
import { getFlythroughSettings } from './FlythroughProgressionStyle'

const DEFAULT_DURATION = 60
const PROFILE_HOVER_RENDER_INTERVAL = 120
const METRIC_OVERLAY_TTL = 2000

const flythroughStore = () => globalThis.lgs?.stores?.flythrough

export class FlythroughMode {
    #controller
    #renderer
    #sampler = null
    #unbind = []
    #requestRenderMode = null
    #pendingProfileHoverSample = null
    #profileHoverTimeout = null
    #lastProfileHoverRender = 0

    constructor({
                    controller = new FlythroughPlaybackController(),
                    renderer = new FlythroughCesiumRenderer(),
                } = {}) {
        this.#controller = controller
        this.#renderer = renderer
        this.#bindRenderer()
    }

    get controller() {
        return this.#controller
    }

    get sampler() {
        return this.#sampler
    }

    get running() {
        return this.#controller.running
    }

    get playing() {
        return this.#controller.playing
    }

    get paused() {
        return this.#controller.paused
    }

    configure = (options = {}) => {
        const store = flythroughStore()
        const journey = options.journey ?? globalThis.lgs?.theJourney

        if (!journey) {
            return null
        }

        const flythrough = getFlythroughSettings()
        const scope = FLYTHROUGH_SCOPE_ALL_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug
        const progression = options.progression ?? flythrough.progression
        const profileInfo = options.profileInfo ?? flythrough.profileInfo

        this.#sampler = new FlythroughPathSampler({
            journey,
            scope,
            trackSlug,
            includeHiddenTracks: options.includeHiddenTracks ?? false,
        })

        if (store) {
            store.journeySlug = journey.slug
            store.trackSlug = trackSlug ?? null
            store.scope = scope
            store.totalDistance = this.#sampler.totalDistance
            store.progression = progression
            store.profileInfo = profileInfo
        }

        this.#controller.configure({
            sampler:   this.#sampler,
            duration:  options.duration ?? flythrough.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction: 1,
            loop:      options.loop ?? flythrough.loop ?? store?.loop ?? false,
            progress:  options.progress ?? store?.progress ?? 0,
        })

        this.#renderer.show({
            sampler: this.#sampler,
            options: {
                radius: store?.markerRadius,
            },
        })

        return this.#sampler
    }

    start = (options = {}) => {
        this.#renderer.clear()
        const sampler = this.configure(options)
        if (!sampler?.hasSamples) {
            return null
        }

        return this.#controller.start({
            progress: options.progress ?? 0,
        })
    }

    pause = () => this.#controller.pause()

    resume = () => this.#controller.resume()

    setLoop = loop => {
        const enabled = this.#controller.setLoop(loop)
        const store = flythroughStore()
        if (store) {
            store.loop = enabled
        }
        return enabled
    }

    toggle = () => {
        if (this.#controller.playing) {
            return this.pause()
        }

        if (this.#controller.paused) {
            return this.resume()
        }

        return this.start()
    }

    seek = progress => this.#controller.seek(progress)

    refresh = () => {
        const sample = this.#controller.currentSample()
        if (sample && this.#sampler) {
            this.#renderer.update({
                sample,
                sampler: this.#sampler,
                forceGeometry: true,
            })
        }
        return sample
    }

    handleProfileHover = ({sample, source = 'profile'} = {}) => {
        if (!sample) {
            return null
        }

        const store = flythroughStore()
        if (store) {
            store.hoverSample = sample
            store.metricOverlay = {
                visible:   true,
                source,
                anchor:    {
                    longitude: sample.longitude,
                    latitude:  sample.latitude,
                    altitude:  sample.altitude ?? sample.height,
                },
                sample,
                expiresAt: Date.now() + METRIC_OVERLAY_TTL,
            }
        }

        this.#scheduleProfileHoverMarker(sample)
        return sample
    }

    handleProfileLeave = () => {
        const store = flythroughStore()
        if (store) {
            store.hoverSample = null
        }
    }

    stop = (options = {}) => {
        const sample = this.#controller.stop(options)
        this.#renderer.clear()
        const store = flythroughStore()
        if (store) {
            store.active = false
            store.playing = false
            store.paused = false
            store.toolbarVisible = false
            store.hoverSample = null
            store.metricOverlay = {
                ...store.metricOverlay,
                visible:   false,
                sample:    null,
                expiresAt: 0,
            }
        }
        return sample
    }

    dispose = () => {
        this.stop({emit: false})
        if (this.#profileHoverTimeout !== null) {
            clearTimeout(this.#profileHoverTimeout)
            this.#profileHoverTimeout = null
        }
        this.#unbind.forEach(unbind => unbind())
        this.#unbind = []
    }

    #setContinuousRender = (enabled) => {
        const scene = globalThis.lgs?.scene
        if (!scene) {
            return
        }

        if (enabled) {
            if (this.#requestRenderMode === null) {
                this.#requestRenderMode = scene.requestRenderMode
            }
            scene.requestRenderMode = false
            scene.requestRender?.()
            return
        }

        if (this.#requestRenderMode !== null) {
            scene.requestRenderMode = this.#requestRenderMode
            this.#requestRenderMode = null
        }
        scene.requestRender?.()
    }

    #scheduleProfileHoverMarker = (sample) => {
        this.#pendingProfileHoverSample = sample
        const now = performance.now()
        const elapsed = now - this.#lastProfileHoverRender

        if (elapsed >= PROFILE_HOVER_RENDER_INTERVAL) {
            this.#renderProfileHoverMarker()
            return
        }

        if (this.#profileHoverTimeout === null) {
            this.#profileHoverTimeout = setTimeout(
                this.#renderProfileHoverMarker,
                PROFILE_HOVER_RENDER_INTERVAL - elapsed,
            )
        }
    }

    #renderProfileHoverMarker = () => {
        this.#profileHoverTimeout = null
        this.#lastProfileHoverRender = performance.now()

        const sample = this.#pendingProfileHoverSample
        this.#pendingProfileHoverSample = null
        if (!sample) {
            return
        }

        globalThis.__?.ui?.profiler?.showSampleOnMap?.(sample)
    }

    #bindRenderer = () => {
        this.#unbind.push(
            this.#controller.on(FLYTHROUGH_EVENT_START, detail => {
                this.#setContinuousRender(true)
                this.#renderer.show({sampler: detail.sampler})
                this.#renderer.update({...detail, forceGeometry: true})
            }),
            this.#controller.on(FLYTHROUGH_EVENT_UPDATE, detail => this.#renderer.update(detail)),
            this.#controller.on(FLYTHROUGH_EVENT_PAUSE, detail => {
                this.#renderer.update({...detail, forceGeometry: true})
                this.#setContinuousRender(false)
            }),
            this.#controller.on(FLYTHROUGH_EVENT_RESUME, detail => {
                this.#setContinuousRender(true)
                this.#renderer.update({...detail, forceGeometry: true})
            }),
            this.#controller.on(FLYTHROUGH_EVENT_STOP, () => {
                this.#setContinuousRender(false)
                this.#renderer.clear()
                const store = flythroughStore()
                if (store) {
                    store.toolbarVisible = false
                    store.hoverSample = null
                    store.metricOverlay = {
                        ...store.metricOverlay,
                        visible:   false,
                        sample:    null,
                        expiresAt: 0,
                    }
                }
            }),
            this.#controller.on(FLYTHROUGH_EVENT_END, () => {
                this.#setContinuousRender(false)
                this.#renderer.clear()
                const store = flythroughStore()
                if (store) {
                    store.toolbarVisible = false
                    store.hoverSample = null
                    store.metricOverlay = {
                        ...store.metricOverlay,
                        visible:   false,
                        sample:    null,
                        expiresAt: 0,
                    }
                }
            }),
        )
    }
}
