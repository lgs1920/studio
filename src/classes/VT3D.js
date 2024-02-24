import {proxy} from 'valtio'

export class VT3D {
    #mainProxy
    #editorProxy
    tracks = []
    #trackStore
    #viewer


    constructor() {
        // TODO save/read tracks in DB (local or remote)


        // Declare Stores and snapshots for states management by @valtio

        // Editor store is used to manage the settings of the currentTrack in edit
        this.#editorProxy = proxy({
            track: null,
        })

        // Main is global to the app
        this.#mainProxy = proxy({
            components: {
                cameraPosition: {
                    show: false,
                },
                credits: {show: false},
                tracksEditor: {
                    visible: false,
                    show: false,
                    list: [],
                    trackListKey: 0,
                    trackSettingsKey: 0,
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

        // Get the first as current currentTrack
        if (this.tracks.length) {
            this.mainProxy.currentTrack = this.tracks[0]
            this.addToEditor()
        }


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

    get trackStore() {
        return this.#trackStore
    }

    get tracks() {
        return this.tracks
    }

    get currentTrack() {
        return this.#mainProxy.currentTrack
    }

    set currentTrack(track) {
        this.#mainProxy.currentTrack = track
        this.addToEditor()
    }

    get mainProxy() {
        return this.#mainProxy
    }

    get editorProxy() {
        return this.#editorProxy
    }

    getTrackBySlug(slug) {
        return this.tracks.filter(function (track) {
            return track.slug === slug
        })[0]
    }

    addTrack = (track) => {
        if (track) {
            // Look if this currentTrack already exist in context
            const index = this.tracks.findIndex(item => item.slug === track.slug)
            if (index >= 0) {           // Found ! We replace it
                this.tracks[index] = track
            } else {                    // Nope,we add it
                this.tracks.push(track)
                this.mainProxy.components.tracksEditor.visible = true
                this.mainProxy.components.tracksEditor.list.push(track.slug)
            }
        }
    }

    addToEditor = () => {
        this.editorProxy.track = {...this.mainProxy.currentTrack}
    }
}