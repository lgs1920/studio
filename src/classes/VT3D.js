import { proxy }             from 'valtio'
import { AppUtils }          from '../Utils/AppUtils'
import { MouseUtils }        from '../Utils/cesium/MouseUtils'
import { CSSUtils }          from '../Utils/CSSUtils'
import { MouseEventHandler } from './MouseEventHandler'
import { main }              from './stores/main'
import { trackEditor }       from './stores/trackEditor'

export class VT3D {
    #mainProxy
    #trackEditorProxy
    tracks = []
    eventHandler = new MouseEventHandler()
    #viewer

    floatingMenu = {}


    constructor() {
        // TODO save/read tracks in DB (local or remote)

        // Declare Stores and snapshots for states management by @valtio

        // Track Editor store is used to manage the settings of the currentTrack in edit
        this.#trackEditorProxy = proxy(trackEditor)

        // Main is global to the app
        this.#mainProxy = proxy(main)

        // Get the first as current currentTrack
        if (this.tracks.length) {
            this.mainProxy.currentTrack = this.tracks[0]
            this.addToEditor(this.tracks[0])
        }

        this.floatingMenu = {
            element: undefined,
            menu: undefined,
        }

        // Utils are attached to window
        window._utils = {
            app: AppUtils,
            ui: {
                css: CSSUtils,
                mouse: MouseUtils,
            },
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
        return this?.scene?.canvas
    }

    get tracks() {
        return this.tracks
    }

    get currentTrack() {
        return this.#mainProxy.currentTrack
    }

    set currentTrack(track) {
        this.#mainProxy.currentTrack = track
        this.addToEditor(track)
    }

    get mainProxy() {
        return this.#mainProxy
    }

    get trackEditorProxy() {
        return this.#trackEditorProxy
    }

    getTrackBySlug(slug) {
        return this.tracks.filter(function (track) {
            return track.slug === slug
        })[0]
    }


    /**
     * Save or replace track in context
     *
     * @param track
     */
    saveTrack = (track) => {
        if (track) {
            // Look if this currentTrack already exist in context
            const index = this.tracks.findIndex(item => item.slug === track.slug)
            if (index >= 0) {           // Found ! We replace it
                this.tracks[index] = track
                this.mainProxy.components.tracksEditor.list[index] = track.slug
            } else {                    // Nope,we add it
                this.tracks.push(track)
                this.mainProxy.components.tracksEditor.list.push(track.slug)
            }
            this.mainProxy.components.tracksEditor.usable = true
        }
    }

    addToEditor = (track) => {
        this.trackEditorProxy.track = track
    }
}