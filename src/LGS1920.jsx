/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-06
 * Last modified: 2026-03-06
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
    Viewer,
}                       from '@Components/cesium/Viewer'
import {
    InitErrorMessage,
}                       from '@Components/InitErrorMessage'
import {
    MainUI,
}                       from '@Components/MainUI/MainUI.jsx'
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
    APP_EVENT, BASE_ENTITY, CURRENT_JOURNEY, FOCUS_LAST, FOCUS_STARTER, OVERLAY_ENTITY, POI_STARTER_TYPE,
    WIDGET_GOOGLE_FONTS,
}                       from '@Core/constants'
import {
    LGS1920Context,
}                       from '@Core/LGS1920Context'
import {
    MapTarget,
}                       from '@Core/MapTarget'
import {
    LayersAndTerrainManager,
}                       from '@Core/ui/LayerAndTerrainManager'
import {
    TerrainUtils,
}                       from '@Utils/cesium/TerrainUtils'
import {
    TrackUtils,
}                       from '@Utils/cesium/TrackUtils'
import {
    UIToast,
}                       from '@Utils/UIToast'
import { WaToast } from '@web.awesome.me/webawesome-pro/dist/react'
import {
    preCache,
}                       from '@zumer/snapdom'
import {
    useEffect, useState,
}                       from 'react'

export const LGS1920 = () => {
    // State to track initialization status and errors
    const [initStatus, setInitStatus] = useState(null)
    const [initError, setInitError] = useState(null)

    /**
     * Initializes the global LGS1920 context
     * @returns {LGS1920Context} The initialized context
     */
    const initializeContext = () => {
        window.lgs = new LGS1920Context()
        return window.lgs
    }

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
    }

    /**
     * Initializes terrain, journeys, and POIs
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<void>}
     */
    const initializeData = async lgs => {
        await TerrainUtils.changeTerrain(lgs.settings.layers.terrain)
        await TrackUtils.readAllFromDB()
        await __.ui.poiManager.initialize()
        await __.ui.poiManager.readAllFromDB()
    }

    /**
     * Sets up the starter POI if not present
     * @param {LGS1920Context} lgs - The application context
     * @returns {Promise<Object>} The starter POI
     */
    const setupStarterPOI = async lgs => {
        let starter = __.ui.poiManager.starter
        if (!starter) {
            starter = await __.ui.poiManager.add({
                                                     longitude:   lgs.settings.starter.longitude,
                                                     latitude:    lgs.settings.starter.latitude,
                                                     height:      lgs.settings.starter.height,
                                                     title:       lgs.settings.starter.title,
                                                     description: lgs.settings.starter.description,
                                                     color:       lgs.settings.starter.color,
                                                     bgColor:     lgs.settings.starter.bgColor,
                                                     type:        POI_STARTER_TYPE,
                                                 }, false, true)
        }
        lgs.stores.main.components.pois.current = starter.id
        return starter
    }

    /**
     * Configures the camera based on settings and focus mode
     * @param {LGS1920Context} lgs - The application context
     * @param {Object} starter - The starter POI
     * @returns {Promise<{focusTarget: Object, cameraStore: Object}>} The focus target and camera settings
     */
    const configureCamera = async (lgs, starter) => {
        let focusTarget = null
        let cameraStore = null

        if (!lgs.theJourney) {
            __.ui.cameraManager.reset()
        }

        if (__.ui.cameraManager.isAppFocusOn(FOCUS_STARTER)) {
            focusTarget = starter
            cameraStore = {
                target:   {
                    longitude: starter.longitude,
                    latitude:  starter.latitude,
                    height:    starter.height,
                },
                position: {
                    longitude: undefined,
                    latitude:  undefined,
                    height:    undefined,
                    heading:   lgs.settings.camera.heading,
                    pitch:     lgs.settings.camera.pitch,
                    roll:      lgs.settings.camera.roll,
                    range:     lgs.settings.camera.range,
                },
            }
        }
        else if (__.ui.cameraManager.isAppFocusOn(FOCUS_LAST)) {
            cameraStore = await __.ui.cameraManager.readCameraInformation()
        }
        else {
            if (__.ui.cameraManager.isJourneyFocusOn(FOCUS_LAST)) {
                cameraStore = await __.ui.cameraManager.readCameraInformation()
            }
            else {
                focusTarget = lgs.theJourney
                cameraStore = lgs.theJourney.camera
                cameraStore.target = new MapTarget(CURRENT_JOURNEY, await __.ui.sceneManager.getJourneyCentroid(lgs.theJourney))
            }
        }

        return {focusTarget, cameraStore}
    }

    /**
     * Sets the camera focus and dispatches initialization event
     * @param {LGS1920Context} lgs - The application context
     * @param {Object} starter - The starter POI
     * @param {Object} focusTarget - The focus target
     * @param {Object} cameraStore - The camera settings
     */
    const setCameraFocus = (lgs, starter, focusTarget, cameraStore) => {
        __.ui.sceneManager.focus(cameraStore.target, {
            target:   focusTarget,
            heading:  cameraStore.position.heading,
            pitch:    __.ui.sceneManager.noRelief() ? -90 : cameraStore.position.pitch,
            roll:     cameraStore.position.roll,
            range:    cameraStore.position.range,
            infinite: true,
            rotate:   lgs.settings.ui.camera.start.rotate.app,
            lookAt:   true,
            rpm:      lgs.settings.starter.camera.rpm,
            callback: point => {
                const initEvent = new CustomEvent(APP_EVENT.INITIAL_FOCUS, {
                    detail: {
                        point,
                        timestamp: Date.now(),
                    },
                })
                window.dispatchEvent(initEvent)
            },
        })
        starter.animated = lgs.settings.ui.camera.start.rotate.app
    }

    /**
     * Initializes the application on component mount
     */
    useEffect(() => {
        /**
         * Main initialization function
         */
        const initialize = async () => {
            try {
                // Initialize context
                const lgs = initializeContext()

                // Initialize app
                const initResult = await initializeApp()
                setInitStatus(initResult.status)
                setInitError(initResult.error)

                if (!initResult.status) {
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

                // Set up starter POI
                const starter = await setupStarterPOI(lgs)

                // Configure camera
                const {focusTarget, cameraStore} = await configureCamera(lgs, starter)

                // Set camera focus
                setCameraFocus(lgs, starter, focusTarget, cameraStore)
                // Initialize the widget cache
                await __.ui.widgetCache.init()

                // Add font to snapdom cache
                await preCache({
                                   root:       document.body,
                                   embedFonts: true,
                                   localFonts: WIDGET_GOOGLE_FONTS.map(family => ({
                                       family,
                                       src:    `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@400;700&display=swap`,
                                       weight: 400,
                                   })),
                               })

                // Mark UI as initialized
                __.app.uiInit = true

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
            }
        }

        initialize()
    }, [])

    return (
        <>
            <WaToast placement="bottom-start" className="lgs-toaster"/>

            {!initStatus && initError && <InitErrorMessage message={initError.message}/>}
            {initStatus && (
                <>
                    <ToolsUI/>
                    <MainUI/>
                    <ResponsiveDevice/>
                    <AppUpdate/>
                    <WelcomeModal/>
                    <MapLayer type={BASE_ENTITY}/>
                    <MapLayer type={OVERLAY_ENTITY}/>
                    <Viewer/>
                    <SelectionIndicator/>
                    <WaToast/>

                </>
            )}
        </>
    )
}