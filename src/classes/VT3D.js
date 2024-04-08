import { proxy }             from 'valtio'
import { AppUtils }          from '../Utils/AppUtils'
import { MouseUtils }        from '../Utils/cesium/MouseUtils'
import { CSSUtils }          from '../Utils/CSSUtils'
import { LocalDB }           from './db/LocalDB'
import { MouseEventHandler } from './MouseEventHandler'
import { main }              from './stores/main'
import { theJourneyEditor }  from './stores/theJourneyEditor'

export class VT3D {
    #mainProxy
    #theJourneyEditorProxy

    tracks = new Map()
    markers = new Map()

    eventHandler = new MouseEventHandler()
    #viewer

    floatingMenu = {}
    journeys = new Map()


    constructor() {
        // Declare Stores and snapshots for states management by @valtio
        // Track Editor store is used to manage the settings of the theJourney in edit
        this.#theJourneyEditorProxy = proxy(theJourneyEditor)
        // Main is global to the app
        this.#mainProxy = proxy(main)

        // Get the first as current theJourney
        if (this.tracks.size) {
            const first = Array.from(this.#theJourneyEditorProxy.tracks)[0]
            this.mainProxy.theJourney = first
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
            journeys: new LocalDB({
                name: `${APP_KEY}`,
                store: [JOURNEYS_STORE, CURRENT_STORE, ORIGIN_STORE, SETTINGS_STORE],
                manageTransients: true,
                version: '0.1',
            }),
        }

        //wander mode
        this.wanderMode = false

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

    get theJourney() {
        return this.#mainProxy.theJourney
    }

    set theJourney(track) {
        this.#mainProxy.theJourney = track
        if (track === null) {
            this.db.tracks.delete(CURRENT_JOURNEY, CURRENT_STORE).then()
            return
        }
        this.db.tracks.put(CURRENT_JOURNEY, track.slug, CURRENT_STORE).then(this.addToEditor(track))
    }

    get mainProxy() {
        return this.#mainProxy
    }

    get theJourneyEditorProxy() {
        return this.#theJourneyEditorProxy
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
            const index = this.mainProxy.components.journeyEditor.list.findIndex(item => item === track.slug)
            if (index >= 0) {
                // Look if this theJourney already exist in context
                this.tracks.set(track.slug, track)
                this.mainProxy.components.journeyEditor.list[index] = track.slug
            } else {                    // Nope,we add it
                this.tracks.set(track.slug, track)
                this.mainProxy.components.journeyEditor.list.push(track.slug)
            }
            this.mainProxy.components.journeyEditor.usable = true
        }

    }

    addToEditor = (track) => {
        this.theJourneyEditorProxy.track = track
    }
}

export const APP_KEY = 'VT3D'
export const SETTINGS_STORE = 'settings'
export const CURRENT_STORE = 'current'
export const JOURNEYS_STORE = 'journeys'
export const ORIGIN_STORE = 'origin'
export const CURRENT_JOURNEY = 'current-journey'