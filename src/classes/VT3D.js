import {proxy} from 'valtio'

export class VT3D {
    #store
    tracks = []
    #trackStore
    #viewer


    constructor() {
        // TODO save/read tracks in DB (local or remote)


        this.editor = proxy({
            track: null,
        })

        // Get the first as current track
        if (this.tracks.length) {
            this.currentTrack = this.tracks[0]
            this.addToEditor()
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

    get viewer() {
        return this.#viewer
    }

    set viewer(viewer) {
        this.#viewer = viewer
    }

    get scene() {
        return this.#viewer?.scene
    }

    get camera() {
        return this?.scene?.camera
    }

    get canvas() {
        return this?.canvas
    }

    get store() {
        return this.#store
    }

    get trackStore() {
        return this.#trackStore
    }

    get tracks() {
        return this.tracks
    }

    get track() {
        return this.currentTrack
    }

    set track(track) {
        this.currentTrack = track
        this.addToEditor()
    }

    getTrackBySlug(slug) {
        return this.tracks.filter(function (track) {
            return track.slug === slug
        })[0]
    }

    addTrack = (track) => {
        if (track) {
            // Look if this track already exist in context
            const index = this.tracks.findIndex(item => item.slug === track.slug)
            if (index >= 0) {           // Found ! We replace it
                this.tracks[index] = track
            } else {                    // Nope,we add it
                this.tracks.push(track)
                vt3d.store.components.tracksEditor.visible = true
                vt3d.store.components.tracksEditor.list.push(track.slug)
            }
        }
    }

    addToEditor = () => {
        this.editor.track = {...this.currentTrack}

    }
}