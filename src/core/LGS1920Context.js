import { AppUtils }   from '@Utils/AppUtils'
import { MouseUtils } from '@Utils/cesium/MouseUtils'
import { CSSUtils }   from '@Utils/CSSUtils'
import { UIUtils }    from '@Utils/UIUtils'

import { proxy }                          from 'valtio'
import { UnitUtils }                      from '../Utils/UnitUtils'
import { LocalDB }                        from './db/LocalDB'
import { Layer }                          from './Layer.js'
import { MouseEventHandler }              from './MouseEventHandler'
import { main }                           from './stores/main'
import { theJourneyEditor }               from './stores/theJourneyEditor'
import { CameraManager as CameraManager } from './ui/CameraManager'
import { JourneyEditor }                  from './ui/JourneyEditor'
import { Profiler }                       from './ui/Profiler'
import { Wanderer }                       from './ui/Wanderer'

export const CONFIGURATION = 'config.json'
export const SERVERS = 'servers.json'
export const BUILD = 'build.json'

export const platforms = {
    DEV:     'development',
    STAGING: 'staging',
    PROD:    'production',
    TEST:    'test',
}

export class LGS1920Context {
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
        this.journeyEditorStore = this.#mainProxy.components.journeyEditor
        this.mainUIStore = this.#mainProxy.components.mainUI

        this.#mainProxy.layer = Layer.IGN_AERIAL

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
        window.__ = {
            app: AppUtils,
            ui: {
                css: CSSUtils,
                mouse: MouseUtils,
                ui:UIUtils
            },
            convert: UnitUtils.convert,
        };

        (async (o) => await o.initializeConfig())(this)

    }

    createDB = () => {
        const dbPrefix = (this.platform === platforms.PROD) ? '' : `-${this.platform}`
        this.db = {
            lgs1920: new LocalDB({
                                     name:             `${APP_KEY}${dbPrefix}`,
                                     store:            [JOURNEYS_STORE, CURRENT_STORE, ORIGIN_STORE, SETTINGS_STORE],
                                     manageTransients: true,
                                     version:          '0.1',
                                 }),
        }
    }


    initializeConfig = async () => {
        this.configuration = await fetch(CONFIGURATION).then(
            res => res.json(),
        )
        this.servers = await await fetch(SERVERS).then(
            res => res.json(),
        )
        this.platform = lgs.servers.platform
    }

    /** @return {Viewer} */
    get viewer() {
        return this.#viewer
    }


    set viewer(viewer) {
        this.#viewer = viewer
    }

    /** @return {Scene} */
    get scene() {
        return this.#viewer?.scene
    }

    /** @return {Camera} */
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
            this.db.lgs1920.delete(CURRENT_JOURNEY, CURRENT_STORE).then(
                this.db.lgs1920.delete(CURRENT_TRACK, CURRENT_STORE).then()
            )
            return
        }
        this.db.lgs1920.put(CURRENT_JOURNEY, journey.slug, CURRENT_STORE).then(journey.addToEditor())
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
            this.db.lgs1920.delete(CURRENT_TRACK, CURRENT_STORE).then()
            return
        }
        this.db.lgs1920.put(CURRENT_TRACK, track.slug, CURRENT_STORE)
    }

    get mainProxy() {
        return this.#mainProxy
    }

    get theJourneyEditorProxy() {
        return this.#theJourneyEditorProxy
    }

    set theJourneyEditorProxy(proxy) {
        this.#theJourneyEditorProxy = proxy
    }

    get units() {
        return lgs.configuration.units
    }

    setDefaultConfiguration = () => {
        // Defaults
        this.POI_DEFAULT_SIZE = this.configuration.journey.pois.size
        this.POI_PIN_DEFAULT_SIZE = this.configuration.journey.pois.size
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
    saveJourneyInContext = (journey) => {
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
            this.mainProxy.canViewJourneyData = true
        }
    }

    /**
     * Add this theJourney to the application context
     *
     */
    addToContext = (setToCurrent = true) => {
        lgs.saveJourneyInContext(this)
        if (setToCurrent) {
            lgs.theJourney = this
        }
    }

    addToEditor = (journey) => {
        this.theJourneyEditorProxy.journey = journey
    }

    cleanEditor = () => {
        this.theJourneyEditorProxy = proxy(theJourneyEditor)
    }

    initManagers = () => {
        __.ui.profiler = new Profiler(this)
        __.ui.editor = {
            journey:new JourneyEditor()
        }
        __.ui.wanderer = new Wanderer()
        __.ui.cameraManager = new CameraManager()
    }


}


export const APP_KEY = 'LGS1920'
export const SETTINGS_STORE = 'settings'
export const CURRENT_STORE = 'current'
export const JOURNEYS_STORE = 'journeys'
export const ORIGIN_STORE = 'origin'
export const CURRENT_JOURNEY = 'journey'
export const CURRENT_TRACK = 'track'
export const CURRENT_POI = 'poi'

export const DRAW_THEN_SAVE = 1
export const DRAW_WITHOUT_SAVE = 2
export const JUST_SAVE = 3

export const COLOR_SWATCHES_NONE = 'none'
export const COLOR_SWATCHES_SERIE = 'serie'
export const COLOR_SWATCHES_RANDOM = 'random'