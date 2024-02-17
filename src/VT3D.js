import {proxy}    from 'valtio'
import {AppUtils} from './Utils/AppUtils'

export class VT3D {
    #context
    #store

    constructor() {
        // Context is dedicated to maps
        this.#context = {
            tracks: [],
        }

        // We use valtio to manage states
        this.#store = proxy({
            components: {
                cameraPosition: {
                    show: false,
                },
                credits: {show: false},
            },

        })
    }


    get context() {
        return this.#context
    }

    get viewer() {
        return this.#context.viewer
    }

    set viewer(viewer) {
        this.#context.viewer = viewer
    }

    get scene() {
        return this.#context.viewer?.scene
    }

    get camera() {
        return this?.scene?.camera
    }

    get canvas() {
        return this.#context?.canvas
    }

    get store() {
        return this.#store
    }


    get tracks() {
        return this.#context.tracks
    }

    getTrackByName(name) {
        return this.#context.tracks.filter(function (track) {
            return track.name === name
        })[0]
    }

    addTrack = (track) => {
        if (track) {
            this.#context.tracks.push({
                [AppUtils.slugify(`${track.name}-${track.type}`)]: track,
            })
        }
    }

}