/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
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
import {
    MapLayer,
}                       from '@Components/cesium/MapLayer'
import {
    ensureViewer,
    Viewer,
}                       from '@Components/cesium/Viewer'
import {
    InitErrorMessage,
}                       from '@Components/InitErrorMessage'
import {
    MainUI,
}                       from '@Components/MainUI/MainUI.jsx'
import { Toast } from '@Components/Toast'
import '@shoelace-style/shoelace/dist/themes/light.css'
import ResponsiveDevice from '@Components/MainUI/ResponsiveDevice'
import {
    SelectionIndicator,
}                       from '@Components/MainUI/SelectionIndicator'
import {
    ToolsUI,
}                       from '@Components/MainUI/ToolsUI'
import {
    WelcomeModal,
}                       from '@Components/MainUI/WelcomeModal'
import {
    APP_EVENT, BASE_ENTITY, CURRENT_JOURNEY, OVERLAY_ENTITY, POI_STARTER_TYPE,
}                       from '@Core/constants'
import {
    LayersAndTerrainManager,
}                       from '@Core/ui/LayerAndTerrainManager'
import {
    buildStartupCameraFocusOptions,
    configureStartupCamera,
}                       from '@Core/ui/cameraStartup'
import { runDeferredJourneyDataLoad } from '@Core/ui/deferredJourneyData'
import {
    TerrainUtils,
}                       from '@Utils/cesium/TerrainUtils'
import {
    TrackUtils,
}                       from '@Utils/cesium/TrackUtils'
import {
    UIToast,
}                       from '@Utils/UIToast'
import {
    useCallback, useEffect, useRef, useState,
}                       from 'react'

const APP_SURFACE_READY_TIMEOUT = 1500

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

const waitForAppSurfaceReady = () => new Promise(resolve => {
    const scene = lgs?.scene

    if (!scene) {
        nextFrame().then(resolve)
        return
    }

    let done = false
    const cleanup = []

    const finish = () => {
        if (done) {
            return
        }

        done = true
        cleanup.forEach(remove => remove?.())
        resolve()
    }

    const timeout = window.setTimeout(finish, APP_SURFACE_READY_TIMEOUT)
    cleanup.push(() => window.clearTimeout(timeout))

    cleanup.push(scene.postRender.addEventListener(finish))

    scene.requestRender?.()
    nextFrame().then(() => {
        scene.requestRender?.()
        return nextFrame()
    }).then(finish)
})

const AppSurface = ({onReady}) => {
    useEffect(() => {
        let cancelled = false

        const ready = async () => {
            document.body.classList.remove('lgs-app-booting')
            await nextFrame()
            await nextFrame()
            await waitForAppSurfaceReady()

            if (!cancelled) {
                onReady?.()
            }
        }

        ready()

        return () => {
            cancelled = true
        }
    }, [onReady])

    useEffect(() => {
        return () => {
            __.ui.flythrough?.stop?.({emit: false})
            __.ui.flythrough?.restoreJourneyToolbarVisibility?.()
        }
    }, [])

    return (
        <>
            <div id="drawer-root" className="drawer-wrapper"/>
            <ToolsUI/>
            <MainUI/>
            <ResponsiveDevice/>
            <AppUpdate/>
            <MapLayer type={BASE_ENTITY}/>
            <MapLayer type={OVERLAY_ENTITY}/>
            <Viewer/>
            <SelectionIndicator/>
            <Toast/>
        </>
    )
}

export const LGS1920 = () => {
    // State to track initialization status and errors
    const [initStatus, setInitStatus] = useState(null)
    const [initError, setInitError] = useState(null)
    const [settingsReady, setSettingsReady] = useState(false)
    const [appVisible, setAppVisible] = useState(false)
    const [initialFocusReady, setInitialFocusReady] = useState(false)
    const [appSurfaceReady, setAppSurfaceReady] = useState(false)
    const deferredJourneyDataStarted = useRef(false)

    const revealApp = useCallback(() => {
        document.body.classList.remove('lgs-app-booting')
        document.body.classList.add('lgs-app-visible')
        setAppVisible(true)
    }, [])

    const markAppSurfaceReady = useCallback(() => {
        setAppSurfaceReady(true)
    }, [])

    /**
     * Initializes the application and sets the theme
     * @returns {Promise<{status: boolean, error?: Error}>} The initialization result
     */
    const initializeApp = async () => {
        try {
            const initResult = await __.app.init()
            if (initResult.status) {
                __.app.setTheme()
            }
            return initResult
        }
        catch (error) {
            return {status: false, error}
        }
    }

    /**
     * Initializes UI managers and layers
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<void>}
     */
    const initializeManagersAndLayers = async lgs => {
        await lgs.initManagers()
        __.layersAndTerrainManager = new LayersAndTerrainManager()
        ensureViewer()
    }

    /**
     * Initializes terrain, journeys, and POIs
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<void>}
     */
    const initializeData = async lgs => {
        await TerrainUtils.changeTerrain(lgs.settings.layers.terrain)
        await TrackUtils.readCurrentFromDB()
    }

    const initializeDeferredJourneyData = useCallback(() => runDeferredJourneyDataLoad(), [])

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

    const setupStarterPOI = useCallback(async (lgs, {persist = true} = {}) => {
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

        await __.ui.poiManager.ensurePOILocation(starter.id)
        lgs.stores.main.components.pois.current = starter.id
        return starter
    }, [createStarterFromSettings])

    const initializeStartupPOIs = useCallback(async ({focusTarget, cameraStore, starter}) => {
        const currentJourney = lgs.theJourney
        const target = cameraStore?.target
        const starterFocused = focusTarget === starter || target?.element === POI_STARTER_TYPE || (!currentJourney && target?.id === starter?.id)
        const journeyFocused = focusTarget === currentJourney || target?.element === CURRENT_JOURNEY

        await __.ui.poiManager.initializeStartupPOIs({
                                                        includeStarter: starterFocused,
                                                        journey:        journeyFocused ? currentJourney : null,
                                                    })

        if (starterFocused) {
            await setupStarterPOI(lgs)
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
        const focusOptions = buildStartupCameraFocusOptions({
                                                                cameraStore,
                                                                focusTarget,
                                                                noRelief: __.ui.sceneManager.noRelief(),
                                                                rotate:   lgs.settings.ui.camera.start.rotate.app,
            rpm:      lgs.settings.starter.camera.rpm,
            callback: point => {
                const initEvent = new CustomEvent(APP_EVENT.INITIAL_FOCUS, {
                    detail: {
                        point,
                        timestamp: Date.now(),
                    },
                })
                window.dispatchEvent(initEvent)
                setInitialFocusReady(true)
            },
        })
        __.ui.sceneManager.focus(cameraStore.target, focusOptions)
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
                setSettingsReady(true)

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

        initialize()
    }, [initializeStartupPOIs, setupStarterPOI])

    useEffect(() => {
        if (deferredJourneyDataStarted.current || initStatus !== true || !initialFocusReady || !appSurfaceReady) {
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
    }, [appSurfaceReady, initStatus, initialFocusReady, initializeDeferredJourneyData])

    return (
        <>
            {!initStatus && initError && <InitErrorMessage error={initError}/>}

            {initStatus === true && <AppSurface onReady={markAppSurfaceReady}/>}

            {!initError && !appVisible && (
                <WelcomeModal
                    initComplete={initStatus === true}
                    appReady={initStatus === true && initialFocusReady && appSurfaceReady}
                    settingsReady={settingsReady}
                    onEnter={revealApp}
                />
            )}

        </>
    )
}
