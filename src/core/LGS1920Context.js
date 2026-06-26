/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920Context.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CacheManager }        from '@Core/cache/CacheManager'
import {
    APP_KEY, CONFIGURATION, CURRENT_JOURNEY, CURRENT_STORE, CURRENT_TRACK, GLOBAL_PARENT, JOURNEY_GROUPS_STORE, JOURNEYS_STORE,
    ORIGIN_STORE, platforms, POIS_STORE, SERVERS, SETTINGS_STORE, VAULT_STORE, WIDGETS_STORE,
}                              from '@Core/constants'
import { StoresManager }       from '@Core/stores/StoresManager'
import { installAppShortcuts } from '@Core/events/appShortcuts'
import { ShortcutManager }     from '@Core/events/ShortcutManager'
import { AppToolsManager }     from '@Core/ui/AppToolsManager'
import { AppUpdateManager }    from '@Core/ui/AppUpdateManager'
import { ContextMenu }         from '@Core/ui/context-menu/ContextMenu'
import { DeviceManager }       from '@Core/ui/DeviceManager'
import { Geocoder }            from '@Core/ui/Geocoder'
import { JourneyGroupManager }  from '@Core/ui/JourneyGroupManager'
import { MenuManager }         from '@Core/ui/MenuManager'
import { POIManager }          from '@Core/ui/POIManager'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WidgetCache }         from '@Core/ui/widget-manager/WidgetCache'
import { WidgetManager }       from '@Core/ui/widget-manager/WidgetManager'
import { AppUtils }            from '@Utils/AppUtils'
import { MouseUtils }          from '@Utils/cesium/MouseUtils'
import { IonLayerUtils }       from '@Utils/cesium/IonLayerUtils'
import { CSSUtils }            from '@Utils/CSSUtils'
import { UIToast }             from '@Utils/UIToast'
import { UIUtils }             from '@Utils/UIUtils'
import { UnitUtils }           from '@Utils/UnitUtils'
import { proxy }               from 'valtio'
import { DatabaseSyncManager } from './db/DatabaseSyncManager'
import { LocalDB }             from './db/LocalDB'
import { MouseEventHandler }   from './MouseEventHandler'
import { editorSettings }      from './stores/editorSettings'
import { main }                from './stores/main'
import { theJourneyEditor }    from './stores/theJourneyEditor'
import { CameraManager }       from './ui/CameraManager'
import { ionTokenManager }     from './ui/IonTokenManager'
import { JourneyEditor }       from './ui/JourneyEditor'
import { PanelManager }        from './ui/panels/PanelManager'
import { Profiler }            from './ui/Profiler'
import { SceneManager }        from './ui/SceneManager'
import { FlythroughRunner }    from './ui/FlythroughRunner'
import { FlythroughMode }      from './ui/flythrough/FlythroughMode'
import { FlythroughVideoSync } from './ui/flythrough/FlythroughVideoSync'

export class LGS1920Context {
    /** @type {Proxy} */
    #mainProxy
    /** @type {Proxy} */
    #theJourneyEditorProxy
    /** @type {Proxy} */
    #editorSettingsProxy
    eventHandler = new MouseEventHandler()
    #viewer
    #lang


    floatingMenu = {}
    journeys = new Map()
    databaseSyncManager = null

    constructor() {
        // Declare Stores and snapshots for states management by @valtio
        // Journey Editor store is used to manage the settings of the theJourney in edit
        this.#theJourneyEditorProxy = proxy(theJourneyEditor)
        // Main is global to the app
        this.#mainProxy = proxy(main)
        // SettingsEditor is used to maintain settings UI states
        this.#editorSettingsProxy = proxy(editorSettings)

        this.journeyEditorStore = this.#mainProxy.components.journeyEditor

        this.stores = new StoresManager()// TODO change all stores


        // Progressive web app ?
        this.pwa = window.matchMedia('(display-mode: standalone)').matches

        // lang
        this.#lang = 'en'

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

        this.colorSettings = {}

        // Utils are attached to window
        window.__ = {
            app: AppUtils,
            ui:  {
                css: CSSUtils,
                mouse: MouseUtils,
                ui:  UIUtils,
            },
            convert: UnitUtils.convert,
            // Let's use Cesium if it isok  or window frame functions
            requestAnimationFrame: (callback) => {
                const cesiumRAF = window.Cesium && typeof window.Cesium.requestAnimationFrame === 'function'
                                  ? window.Cesium.requestAnimationFrame
                                  : null
                return (cesiumRAF || requestAnimationFrame)(callback)
            },
            cancelAnimationFrame:  (rafId) => {
                const cesiumCancel = window.Cesium && typeof window.Cesium.cancelAnimationFrame === 'function'
                                     ? window.Cesium.cancelAnimationFrame
                                     : null
                if (cesiumCancel) {
                    cesiumCancel(rafId)
                }
                else {
                    cancelAnimationFrame(rafId)
                }
            },
        }

    }

    /**
     *
     * @return {string}
     */
    get lang() {
        return this.#lang || 'en'
    }

    /**
     *
     * @param lang
     */
    set lang(lang) {
        this.#lang = lang
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
                this.db.lgs1920.delete(CURRENT_TRACK, CURRENT_STORE).then(),
            )
            return
        }
        this.db.lgs1920.put(CURRENT_JOURNEY, journey.slug, CURRENT_STORE).then(journey.addToEditor())
    }

    initializeConfig = async () => {
        this.configuration = await fetch(CONFIGURATION, {cache: 'no-store'}).then(
            res => res.json(),
        )
        this.servers = await await fetch(SERVERS, {cache: 'no-store'}).then(
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

    createDB = () => {
        const dbPrefix = (this.platform === platforms.PROD) ? '' : `-${this.platform}`
        this.db = {
            lgs1920:  new LocalDB({
                                      name:             `${APP_KEY}${dbPrefix}`,
                                      stores:  [
                                          JOURNEYS_STORE, JOURNEY_GROUPS_STORE, CURRENT_STORE, ORIGIN_STORE, POIS_STORE,
                                          {
                                              name:    WIDGETS_STORE,
                                              indexes: [{name: 'group', keyPath: 'data.group'}],
                                          },
                                      ],
                                      manageTransients: false,
                                      version: 22, // integer
                                  }),
            settings: new LocalDB({
                                      name:    `settings-${APP_KEY}${dbPrefix}`,
                                      stores:  [SETTINGS_STORE],
                                      manageTransients: false,
                                      version: 1, // integer
                                  }),
            vault:    new LocalDB({
                                      name:             `vault-${APP_KEY}${dbPrefix}`,
                                      stores:  [VAULT_STORE],
                                      manageTransients: false,
                                      version: 1, // integer
                                  }),
        }

        if (!this.databaseSyncManager) {
            this.databaseSyncManager = new DatabaseSyncManager(this.db)
        }
        else {
            this.databaseSyncManager.setDatabases(this.db)
        }

        __.ui.databaseSyncManager = this.databaseSyncManager

        //   this.db.lgs1920.forceRebuildStore(WIDGETS_STORE)
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

    get editorSettingsProxy() {
        return this.#editorSettingsProxy
    }

    set theJourneyEditorProxy(proxy) {
        this.#theJourneyEditorProxy = proxy
    }

    get units() {
        return lgs.configuration.units
    }

    setDefaultPOIConfiguration = () => {
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
     * Retrieves a journey object based on the provided track slug.
     *
     * @param {string} slug - The track slug used to identify and retrieve the journey.
     * @returns {*} The journey object associated with the processed slug, or undefined if not found.
     */
    getJourneyByTrackSlug = (slug) => {
        if (typeof slug !== 'string' || slug.trim() === '') {
            return undefined
        }
        if (slug === GLOBAL_PARENT) {
            return {slug: GLOBAL_PARENT}
        }
        const parts = slug.split('#')
        if (parts.length === 2) {
            // UC : journey POIs = parent = journey slug
            return this.getJourneyBySlug(slug)
        }
        // UC : tracks POIs
        const journeySlug = slug.split('#').slice(1, 3).join('#')
        return this.getJourneyBySlug(journeySlug)
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
            }
            else {                    // Nope,we add it
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

    cleanContext = () => {
        lgs.theJourney = null
        lgs.theTrack = null
        lgs.cleanEditor()
        lgs.stores.main.canViewJourneyData = false
        lgs.stores.main.components.profile.show = false
        lgs.stores.main.canViewProfile = false
        lgs.stores.main.theJourney = null
    }

    addToEditor = (journey) => {
        this.theJourneyEditorProxy.journey = journey
    }

    cleanEditor = () => {
        this.theJourneyEditorProxy = proxy(theJourneyEditor)
    }

    initManagers = async () => {
        this.databaseSyncManager?.setDatabases(this.db)
        __.ui.databaseSyncManager = this.databaseSyncManager

        await this.databaseSyncManager?.bootstrap?.()
        const syncStartupWarning = this.databaseSyncManager?.startupWarning
        if (syncStartupWarning) {
            window.setTimeout(() => UIToast.warning(syncStartupWarning), 0)
        }

        if (!__.app.cesiumCache) {
            __.app.cesiumCache = new CacheManager(IonLayerUtils.tokenCacheName(), 500 * 1024 * 1024)
        }

        //startCacheMonitoring()

        __.ui.profiler = new Profiler(this)
        __.ui.editor = {
            journey: new JourneyEditor(),
        }

        __.ui.flythroughRunner = new FlythroughRunner()
        __.ui.flythrough = new FlythroughMode()
        __.ui.flythroughVideoSync = new FlythroughVideoSync()
        __.ui.journeyGroupManager = new JourneyGroupManager()
        __.ui.cameraManager = new CameraManager()
        __.ui.drawerManager = new PanelManager()
        __.ui.sceneManager = new SceneManager()
        __.ui.menuManager = new MenuManager()
        __.ui.widgetManager = new WidgetManager()
        __.ui.widgetCache = new WidgetCache()
        __.ui.ionTokenManager = ionTokenManager

        __.ui.poiManager = new POIManager()
        __.ui.geocoder = new Geocoder()
        __.ui.contextMenu = new ContextMenu()
        __.ui.shortcutManager = new ShortcutManager()
        __.ui.addShortcut = (...args) => __.ui.shortcutManager.addShortcut(...args)
        __.ui.removeShortcut = (...args) => __.ui.shortcutManager.removeShortcut(...args)
        __.addShortcut = __.ui.addShortcut
        __.ui.appShortcuts = installAppShortcuts(__.ui.shortcutManager)

        __.tools = new AppToolsManager() // TODO use ui.tools instead of ui.ui
        __.device = new DeviceManager()
        __.recorder = new ScreenMediaRecorder()
        __.updater = new AppUpdateManager()


    }


}
