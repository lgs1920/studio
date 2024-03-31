import { proxy }             from 'valtio'
import { AppUtils }          from '../Utils/AppUtils'
import { MouseUtils }        from '../Utils/cesium/MouseUtils'
import { CSSUtils }          from '../Utils/CSSUtils'
import { LocalDB }           from './db/LocalDB'
import { MouseEventHandler } from './MouseEventHandler'
import { main }              from './stores/main'
import { trackEditor }       from './stores/trackEditor'

export class VT3D {
    #mainProxy
    #trackEditorProxy

    tracks = new Map()
    markers = new Map()

    eventHandler = new MouseEventHandler()
    #viewer

    floatingMenu = {}


    constructor() {
        // Declare Stores and snapshots for states management by @valtio
        // Track Editor store is used to manage the settings of the currentTrack in edit
        this.#trackEditorProxy = proxy(trackEditor)
        // Main is global to the app
        this.#mainProxy = proxy(main)

        // Get the first as current currentTrack
        if (this.tracks.size) {
            const first = Array.from(this.#trackEditorProxy.tracks)[0]
            this.mainProxy.currentTrack = first
            this.addToEditor(this.first)
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

        //Init DBs
        this.db = {
            tracks: new LocalDB({
                name: `${APP_KEY}`,
                store: [TRACKS_STORE, CURRENT_STORE, ORIGIN_STORE, SETTINGS_STORE],
                manageTransients: true,
                version: '0.1',
            }),
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
        if (track === null) {
            this.db.tracks.delete(CURRENT_TRACK, CURRENT_STORE).then()
            return
        }
        this.db.tracks.put(CURRENT_TRACK, track.slug, CURRENT_STORE).then(this.addToEditor(track))
    }

    get mainProxy() {
        return this.#mainProxy
    }

    get trackEditorProxy() {
        return this.#trackEditorProxy
    }

    getTrackBySlug(slug) {
        return this.tracks.get(slug)
    }


    /**
     * Save or replace track in context
     *
     * @param track
     */
    saveTrack = (track) => {
        if (track) {
            const index = this.mainProxy.components.tracksEditor.list.findIndex(item => item === track.slug)
            if (index >= 0) {
                // Look if this currentTrack already exist in context
                this.tracks.set(track.slug, track)
                this.mainProxy.components.tracksEditor.list[index] = track.slug
            } else {                    // Nope,we add it
                this.tracks.set(track.slug, track)
                this.mainProxy.components.tracksEditor.list.push(track.slug)
            }
            this.mainProxy.components.tracksEditor.usable = true
        }

    }

    addToEditor = (track) => {
        this.trackEditorProxy.track = track
    }
}

export const APP_KEY = 'VT3D'
export const SETTINGS_STORE = 'settings'
export const CURRENT_STORE = 'current'
export const TRACKS_STORE = 'tracks'
export const ORIGIN_STORE = 'origin'
export const CURRENT_TRACK = 'current-track'