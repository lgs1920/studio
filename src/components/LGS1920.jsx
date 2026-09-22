/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-02-02
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { AppUpdate }    from '@Components/AppUpdate'
/**
 * Main application component for LGS1920 Studio
 * Initializes the application context, managers, layers, and camera settings
 * Renders the map, UI components, and PWA installation button
 * @returns {JSX.Element} The LGS1920 component
 */
import {AppSurface} from '@Components/AppSurface'
import {ensureViewer} from '@Components/cesium/Viewer'
import {
    InitErrorMessage,
}                       from '@Components/InitErrorMessage'
import '@shoelace-style/shoelace/dist/themes/light.css'
import {
    WelcomeBranding,
}                       from '@Components/MainUI/WelcomeBranding'
import {
    WelcomeHero,
}                       from '@Components/MainUI/WelcomeHero'
import {
    APP_EVENT, CURRENT_JOURNEY, POI_STARTER_TYPE,
}                       from '@Core/constants'
import {
    LayersAndTerrainManager,
}                       from '@Core/ui/LayerAndTerrainManager'
import {
    buildStartupCameraFocusOptions,
    configureStartupCamera,
    getStartupOrbitSettings,
}                       from '@Core/ui/cameraStartup'
import { runDeferredJourneyDataLoad } from '@Core/ui/deferredJourneyData'
import { StartupDataLoader } from '@Core/ui/startup/StartupDataLoader'
import {markStartup, measureStartup} from '@Core/ui/startup/startupTelemetry'
import {
    TerrainUtils,
}                       from '@Utils/cesium/TerrainUtils'
import {
    UIToast,
}                       from '@Utils/UIToast'
import {
    useCallback, useEffect, useRef, useState,
}                       from 'react'
import { useSnapshot } from 'valtio'

const INITIAL_FOCUS_READY_TIMEOUT = 2500

export const LGS1920 = () => {
    // State to track initialization status and errors
    const [initStatus, setInitStatus] = useState(null)
    const [initError, setInitError] = useState(null)
    const [appVisible, setAppVisible] = useState(false)
    const [initialFocusReady, setInitialFocusReady] = useState(false)
    const [currentJourneyReady, setCurrentJourneyReady] = useState(false)
    const [appSurfaceReady, setAppSurfaceReady] = useState(false)
    const deferredJourneyDataStarted = useRef(false)
    const startupDataLoader = useRef(null)
    const appUpdateStore = globalThis.__?.updater?.store
        ?? globalThis.lgs?.stores?.ui?.appUpdate
    const appUpdate = useSnapshot(appUpdateStore)
    const appReady = initStatus === true
        && initialFocusReady
        && currentJourneyReady
        && appSurfaceReady
        && !appUpdate.isAutomaticUpdateInProgress

    const revealApp = useCallback(() => {
        markStartup('app-revealed')
        document.body.classList.remove('lgs-app-booting')
        document.body.classList.add('lgs-app-visible')
        setAppVisible(true)
    }, [])

    const markAppSurfaceReady = useCallback(() => {
        markStartup('surface-ready')
        setAppSurfaceReady(true)
    }, [])

    /**
     * Initializes the application and sets the theme
     * @returns {Promise<{status: boolean, error?: Error}>} The initialization result
     */
    const initializeApp = useCallback(async () => {
        try {
            markStartup('app-init-start')
            const initResult = await __.app.init()
            markStartup('app-init-end', {status: initResult.status})
            measureStartup('app-init', 'app-init-start', 'app-init-end')
            if (initResult.status) {
                __.app.setTheme()
            }
            return initResult
        }
        catch (error) {
            return {status: false, error}
        }
    }, [])

    /**
     * Initializes UI managers and layers
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<void>}
     */
    const initializeManagersAndLayers = async lgs => {
        markStartup('managers-init-start')
        await lgs.initManagers()
        __.layersAndTerrainManager = new LayersAndTerrainManager()
        ensureViewer()
        markStartup('managers-init-end')
        measureStartup('managers-init', 'managers-init-start', 'managers-init-end')
    }

    /**
     * Initializes terrain, journeys, and POIs
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<void>}
     */
    const initializeData = async lgs => {
        markStartup('terrain-init-start')
        void TerrainUtils.changeTerrain(lgs.settings.layers.terrain)
            .then(() => {
                markStartup('terrain-init-end', {status: 'ready'})
                measureStartup('terrain-init', 'terrain-init-start', 'terrain-init-end')
            })
            .catch(error => {
                console.warn('[LGS1920] Terrain startup deferred:', error)
                markStartup('terrain-init-end', {status: 'fallback', error: error?.message})
                measureStartup('terrain-init', 'terrain-init-start', 'terrain-init-end')
            })

        startupDataLoader.current = new StartupDataLoader(lgs.db.lgs1920.dbName)
        markStartup('current-journey-init-start')
        const currentJourney = await startupDataLoader.current.loadCurrentJourney()
        if (!startupDataLoader.current.currentPOIsReady) {
            await startupDataLoader.current.loadPOIs({
                                                      currentOnly: true,
                                                      includeStarter: false,
                                                      journey: currentJourney,
                                                  })
        }
        markStartup('current-journey-init-end', {journey: currentJourney?.slug ?? null})
        measureStartup('current-journey-init', 'current-journey-init-start', 'current-journey-init-end')

        if (!currentJourney) {
            lgs.theJourney = null
            lgs.theTrack = null
            lgs.stores.main.readyForTheShow = true
        }
        else if (lgs.theJourney?.slug !== currentJourney.slug || !lgs.stores.main.readyForTheShow) {
            throw new Error('The current journey did not reach the ready state')
        }

        setCurrentJourneyReady(true)
    }

    const initializeDeferredJourneyData = useCallback(() => runDeferredJourneyDataLoad({
                                                                                          startupLoader: startupDataLoader.current,
                                                                                          currentPOIsReady: true,
                                                                                      }), [])

    /**
     * Sets up the starter POI if not present
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<Object>} The starter POI
     */
    const createStarterFromSettings = useCallback(lgs => ({
        longitude:   lgs.settings.starter.longitude,
        latitude:    lgs.settings.starter.latitude,
        height:      lgs.settings.starter.height,
        title:       lgs.settings.starter.title,
        location:    lgs.settings.starter.location,
        country:     lgs.settings.starter.country,
        countryCode: lgs.settings.starter.countryCode,
        countries:   lgs.settings.starter.countries,
        countryCodes: lgs.settings.starter.countryCodes,
        description: lgs.settings.starter.description,
        color:       lgs.settings.starter.color,
        bgColor:     lgs.settings.starter.bgColor,
        type:        POI_STARTER_TYPE,
    }), [])

    const setupStarterPOI = useCallback(async (lgs, {persist = true, resolveLocation = true} = {}) => {
        let starter = __.ui.poiManager.starter ?? createStarterFromSettings(lgs)
        if (!persist) {
            return starter
        }

        if (!starter) {
            starter = createStarterFromSettings(lgs)
        }
        if (!starter.id) {
            starter = await __.ui.poiManager.add(starter, false, true)
        }

        if (resolveLocation) {
            await __.ui.poiManager.ensurePOILocation(starter.id)
        }
        lgs.stores.main.components.pois.current = starter.id
        return starter
    }, [createStarterFromSettings])

    const initializeStartupPOIs = useCallback(async ({focusTarget, cameraStore, starter}) => {
        const currentJourney = lgs.theJourney
        const target = cameraStore?.target
        const starterFocused = focusTarget === starter || target?.element === POI_STARTER_TYPE || (!currentJourney && target?.id === starter?.id)
        const journeyFocused = focusTarget === currentJourney || target?.element === CURRENT_JOURNEY

        if (!startupDataLoader.current) {
            await __.ui.poiManager.initializeStartupPOIs({
                                                            includeStarter: starterFocused,
                                                            journey:        journeyFocused ? currentJourney : null,
                                                        })
        }

        if (starterFocused) {
            await setupStarterPOI(lgs, {resolveLocation: Boolean(currentJourney)})
        }
    }, [setupStarterPOI])

    /**
     * Sets the camera focus and dispatches initialization event
     * @param {LGS1920Context} lgs - The application context
     * @param {Object} starter - The starter POI
     * @param {Object} focusTarget - The focus target
     * @param {Object} cameraStore - The camera settings
     */
    const setCameraFocus = (lgs, starter, focusTarget, cameraStore) => {
        let focusReady = false
        let focusReadyTimeout = null
        const markInitialFocusReady = point => {
            if (focusReady) {
                return
            }

            focusReady = true
            if (focusReadyTimeout !== null) {
                window.clearTimeout(focusReadyTimeout)
                focusReadyTimeout = null
            }
            const initEvent = new CustomEvent(APP_EVENT.INITIAL_FOCUS, {
                detail: {
                    point,
                    timestamp: Date.now(),
                },
            })
            window.dispatchEvent(initEvent)
            setInitialFocusReady(true)
            markStartup('camera-focus-ready')
        }

        const persistedStarter = __.ui.poiManager.starter
        const startupFocusTarget = focusTarget === starter ? (persistedStarter ?? focusTarget) : focusTarget
        const startupOrbitSettings = getStartupOrbitSettings({
                                                               fallback:        {
                                                                   rpm: lgs.settings.starter.camera.rpm,
                                                               },
                                                               focusTarget,
                                                               persistedStarter,
                                                               starter,
                                                           })
        const focusOptions = buildStartupCameraFocusOptions({
                                                                cameraStore,
                                                                focusTarget: startupFocusTarget,
                                                                noRelief: __.ui.sceneManager.noRelief(),
                                                                rotate:   lgs.settings.ui.camera.start.rotate.app,
            rpm:      startupOrbitSettings.rpm,
            callback: markInitialFocusReady,
        })
        markStartup('camera-focus-start')
        __.ui.sceneManager.focus(cameraStore.target, focusOptions)
        focusReadyTimeout = window.setTimeout(
            () => markInitialFocusReady(cameraStore.target),
            INITIAL_FOCUS_READY_TIMEOUT,
        )
        starter.animated = focusTarget === starter && lgs.settings.ui.camera.start.rotate.app
    }

    useEffect(() => {
        /**
         * Main initialization function
         */
        const initialize = async () => {
            try {
                // Initialize context
                const lgs = window.lgs

                // Initialize app
                const initResult = await initializeApp()
                setInitError(initResult.error)

                if (!initResult.status) {
                    setInitStatus(false)
                    document.body.classList.remove('lgs-app-booting')
                    UIToast.error({
                                      caption: 'LGS1920 was stopped due to initialization errors!',
                                      text:    'We\'re sorry',
                                  })
                    return
                }
                // Initialize managers and layers
                await initializeManagersAndLayers(lgs)

                // Attach drawer events
                __.ui.drawerManager.attachEvents()

                // Set body class for platform-specific CSS
                document.body.classList.add(lgs.platform)

                // Initialize data (terrain, journeys, POIs)
                await initializeData(lgs)

                // Set up starter target from settings. It is persisted only if the first view needs it.
                const starter = await setupStarterPOI(lgs, {persist: false})

                // Configure camera
                const {focusTarget, cameraStore} = await configureStartupCamera({
                                                                                    context:        lgs,
                                                                                    starter,
                                                                                    cameraManager:  __.ui.cameraManager,
                                                                                    sceneManager:   __.ui.sceneManager,
                                                                                    cameraSettings: lgs.settings.camera,
                                                                                })

                // Set camera focus
                await initializeStartupPOIs({focusTarget, cameraStore, starter})
                setCameraFocus(lgs, starter, focusTarget, cameraStore)

                // Mark UI as initialized
                __.app.uiInit = true
                setInitStatus(true)
                void __.ui.widgetCache.init().catch(error => {
                    console.warn('[LGS1920] Widget cache hydration failed:', error)
                })

                // log starting information
                console.log(`LGS1920 ${lgs.versions.studio} has been loaded and is ready on ${lgs.platform} platform !`)
                console.log(`Connected to backend ${lgs.versions.backend}.`)
            }
            catch (error) {
                UIToast.error({
                                  caption: 'LGS1920 was stopped due to errors!',
                                  text: 'We\'re sorry' + '\n' + error.message + '\n' + error.stack,
                              })
                setInitStatus(false)
                setInitError(error)
                document.body.classList.remove('lgs-app-booting')
            }
        }

        void initialize()
    }, [initializeApp, initializeStartupPOIs, setupStarterPOI])

    useEffect(() => () => startupDataLoader.current?.dispose(), [])

    useEffect(() => {
        if (appReady) {
            markStartup('enter-available')
        }
    }, [appReady])

    useEffect(() => {
        if (deferredJourneyDataStarted.current || initStatus !== true || !initialFocusReady || !appVisible) {
            return
        }

        deferredJourneyDataStarted.current = true
        void initializeDeferredJourneyData().catch(error => {
            console.error('[LGS1920] Deferred journey loading failed:', error)
            UIToast.error({
                              caption: 'Journey loading failed!',
                              text:    error.message,
                          })
        })
    }, [appVisible, initStatus, initialFocusReady, initializeDeferredJourneyData])

    return (
        <>
            {!initStatus && initError && <InitErrorMessage error={initError}/>}

            <AppUpdate updateDialogEnabled={appVisible}/>

            {initStatus === true && <AppSurface onReady={markAppSurfaceReady}/>}

            {!initError && !appVisible && (
                <>
                    <WelcomeBranding/>
                    <WelcomeHero
                        initComplete={initStatus === true}
                        appReady={appReady}
                        onEnter={revealApp}
                        showMedia={false}
                    />
                </>
            )}

        </>
    )
}
