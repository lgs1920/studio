import { proxy }             from 'valtio'
import { AppUtils }          from '../Utils/AppUtils'
import { MouseUtils }        from '../Utils/cesium/MouseUtils'
import { CSSUtils }          from '../Utils/CSSUtils'
import { LocalDB }           from './db/LocalDB'
import { MouseEventHandler } from './MouseEventHandler'
import { main }              from './stores/main'
import { theJourneyEditor }  from './stores/theJourneyEditor'

export class VT3D {
    /** @type {Proxy} */
    #mainProxy
    /** @type {Proxy} */
    #theJourneyEditorProxy

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
        if (this.journeys.size) {
            const first = Array.from(this.#theJourneyEditorProxy.journeys)[0]
            this.mainProxytheJourney = first
            first.addToEditor()
        }

        this.floatingMenu = {
            element: undefined,
            menu: undefined,
        }

        // Utils are attached to window
        window._ = {
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

    /**
     * @return {Journey}
     */
    get theJourney() {
        return this.#mainProxy.theJourney
    }

    /**
     *
     * @param journey
     *
     */
    set theJourney(journey) {
        this.#mainProxy.theJourney = journey
        if (journey === null) {
            this.db.journeys.delete(CURRENT_JOURNEY, CURRENT_STORE).then()
            return
        }
        this.db.journeys.put(CURRENT_JOURNEY, journey.slug, CURRENT_STORE).then(journey.addToEditor())
    }

    /**
     *
     * @return {Proxy}
     */
    get theTrack() {
        return this.#mainProxy.theTrack
    }

    set theTrack(track) {
        this.#mainProxy.theTrack = track
        if (track === null) {
            this.db.journeys.delete(CURRENT_TRACK, CURRENT_STORE).then()
            return
        }
        this.db.journeys.put(CURRENT_TRACK, track.slug, CURRENT_STORE)
    }

    get mainProxy() {
        return this.#mainProxy
    }

    get theJourneyEditorProxy() {
        return this.#theJourneyEditorProxy
    }

    setDefaultConfiguration = () => {
        // Defaults
        this.POI_DEFAULT_SIZE = this.configuration.journey.pois.size
        this.POI_DEFAULT_COLOR = this.configuration.journey.pois.color
        this.POI_TRANSPARENT_COLOR = 'transparent'

    }

    /**
     * Get a journey by its slug
     *
     * @param slug
     * @return {Journey}
     */
    getJourneyBySlug(slug) {
        return this.journeys.get(slug)
    }

    /**
     * Get a track from the current Journey
     *                      -------
     *
     * @param slug
     * @return {Track}
     */
    getTrackBySlug(slug) {
        return this.theJourney.tracks.get(slug)
    }

    /**
     * Save or replace journey in context
     *
     * @param journey
     */
    saveJourney = (journey) => {
        if (journey) {
            const index = this.mainProxy.components.journeyEditor.list.findIndex(item => item === journey.slug)
            if (index >= 0) {
                // Look if this theJourney already exist in context
                this.journeys.set(journey.slug, journey)
                this.mainProxy.components.journeyEditor.list[index] = journey.slug
            } else {                    // Nope,we add it
                this.journeys.set(journey.slug, journey)
                this.mainProxy.components.journeyEditor.list.push(journey.slug)
            }
            this.mainProxy.components.journeyEditor.usable = true
        }
    }

    /**
     * Add this theJourney to the application context
     *
     */
    addToContext = (setToCurrent = true) => {
        vt3d.saveJourney(this)
        if (setToCurrent) {
            vt3d.theJourney = this
        }
    }

    addToEditor = (journey) => {
        this.theJourneyEditorProxy.journey = journey
    }

    cleanEditor = () => {
        this.theJourneyEditorProxy = null
    }
}

export const APP_KEY = 'VT3D'
export const SETTINGS_STORE = 'settings'
export const CURRENT_STORE = 'current'
export const JOURNEYS_STORE = 'journeys'
export const ORIGIN_STORE = 'origin'
export const CURRENT_JOURNEY = 'journey'
export const CURRENT_TRACK = 'track'
export const CURRENT_POI = 'poi'
