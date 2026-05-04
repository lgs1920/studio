/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderMode.js
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

import { WanderCesiumRenderer } from './WanderCesiumRenderer'
import {
    WANDER_EVENT_END, WANDER_EVENT_START, WANDER_EVENT_STOP, WANDER_EVENT_UPDATE,
    WanderPlaybackController,
} from './WanderPlaybackController'
import { WanderPathSampler, WANDER_SCOPE_VISIBLE_TRACKS } from './WanderPathSampler'

const DEFAULT_DURATION = 60

const wanderStore = () => globalThis.lgs?.stores?.ui?.mainUI?.wander

export class WanderMode {
    #controller
    #renderer
    #sampler = null
    #unbind = []

    constructor({
                    controller = new WanderPlaybackController(),
                    renderer = new WanderCesiumRenderer(),
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
        const store = wanderStore()
        const journey = options.journey ?? globalThis.lgs?.theJourney

        if (!journey) {
            return null
        }

        const scope = options.scope ?? store?.scope ?? WANDER_SCOPE_VISIBLE_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug

        this.#sampler = new WanderPathSampler({
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
        }

        this.#controller.configure({
            sampler:   this.#sampler,
            duration:  options.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction: options.direction ?? store?.direction ?? 1,
            loop:      options.loop ?? store?.loop ?? false,
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
        const sampler = this.configure(options)
        if (!sampler?.hasSamples) {
            return null
        }

        return this.#controller.start({
            progress: options.progress ?? (this.#controller.direction > 0 ? 0 : 1),
        })
    }

    pause = () => this.#controller.pause()

    resume = () => this.#controller.resume()

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

    stop = (options = {}) => {
        const sample = this.#controller.stop(options)
        this.#renderer.clear()
        const store = wanderStore()
        if (store) {
            store.active = false
            store.playing = false
            store.paused = false
        }
        return sample
    }

    dispose = () => {
        this.stop({emit: false})
        this.#unbind.forEach(unbind => unbind())
        this.#unbind = []
    }

    #bindRenderer = () => {
        this.#unbind.push(
            this.#controller.on(WANDER_EVENT_START, detail => {
                this.#renderer.show({sampler: detail.sampler})
                this.#renderer.update(detail)
            }),
            this.#controller.on(WANDER_EVENT_UPDATE, detail => this.#renderer.update(detail)),
            this.#controller.on(WANDER_EVENT_STOP, () => this.#renderer.clear()),
            this.#controller.on(WANDER_EVENT_END, () => this.#renderer.clear()),
        )
    }
}
