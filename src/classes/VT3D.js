import {proxy} from 'valtio'

export class VT3D {
    #context
    #store

    constructor() {
        // Context is dedicated to maps
        this.#context = {
            tracks: [],   // TODO save/read tracks in DB (local or remote)
        }

        // Get the first as current track
        if (this.#context.tracks.length) {
            this.currentTrack = this.#context.tracks[0]
        }

        // We use valtio to manage states
        this.#store = proxy({
            components: {
                cameraPosition: {
                    show: false,
                },
                credits: {show: false},

            },
            modals: {
                altitudeChoice: {
                    show: false,
                    model: 'terrain',
                },
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

    get track() {
        return this.currentTrack
    }

    getTrackByName(name) {
        return this.#context.tracks.filter(function (track) {
            return track.name === name
        })[0]
    }

    addTrack = (track) => {
        if (track) {
            this.#context.tracks.push({
                [track.slug]: JSON.stringify(track),
            })
            this.currentTrack = track
        }
    }

    saveTrack = (track = this.currentTrack) => {
        this.#context.tracks[track.slug] = JSON.stringify(track)
    }

}