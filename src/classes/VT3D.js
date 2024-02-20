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
                tracksEditor: {
                    visible: false,
                    show: false,
                    list: [],
                },

            },
            modals: {
                altitudeChoice: {
                    show: false,
                    model: 'terrain',
                },
            },
            currentTrack: null,

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

    set track(track) {
        this.currentTrack = track
    }

    getTrackBySlug(slug) {
        return this.#context.tracks.filter(function (track) {
            return track.slug === slug
        })[0]
    }

    addTrack = (track) => {
        if (track) {
            // Look if this track already exist in context
            const index = this.#context.tracks.findIndex(item => item.slug === track.slug)
            if (index >= 0) {           // Found ! We replace it
                this.#context.tracks[index] = track
            } else {                    // Nope,we add it
                this.#context.tracks.push(track)
                vt3d.store.components.tracksEditor.visible = true
                vt3d.store.components.tracksEditor.list.push(track.slug)
            }
        }
    }
}