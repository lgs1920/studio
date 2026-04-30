/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
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
    APP_EVENT, BASE_ENTITY, CURRENT_JOURNEY, FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER, OVERLAY_ENTITY,
    POI_STARTER_TYPE, WIDGET_GOOGLE_FONTS,
}                       from '@Core/constants'
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
import {
    preCache,
}                       from '@zumer/snapdom'
import { Cartesian3 }   from 'cesium'
import {
    useCallback, useEffect, useState,
}                       from 'react'

const APP_SURFACE_READY_TIMEOUT = 10000
const APP_SURFACE_READY_STABLE_FRAMES = 2

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const cameraTargetIsValid = cameraStore => {
    const target = cameraStore?.target
    return finiteNumber(target?.longitude) !== null
        && finiteNumber(target?.latitude) !== null
        && finiteNumber(target?.height) !== null
}

const cameraPositionIsValid = position => finiteNumber(position?.longitude) !== null
    && finiteNumber(position?.latitude) !== null
    && finiteNumber(position?.height) !== null

const cameraRangeFromStoredPosition = (position = {}, target = {}) => {
    const longitude = finiteNumber(position.longitude)
    const latitude = finiteNumber(position.latitude)
    const height = finiteNumber(position.height)
    const targetLongitude = finiteNumber(target.longitude)
    const targetLatitude = finiteNumber(target.latitude)
    const targetHeight = finiteNumber(target.height)

    if ([longitude, latitude, height, targetLongitude, targetLatitude, targetHeight].some(value => value === null)) {
        return null
    }

    return Cartesian3.distance(
        Cartesian3.fromDegrees(longitude, latitude, height),
        Cartesian3.fromDegrees(targetLongitude, targetLatitude, targetHeight),
    )
}

const cameraPositionWithDefaults = (position = {}, target = {}) => {
    const storedRange = finiteNumber(position.range)
    const computedRange = cameraRangeFromStoredPosition(position, target) ?? storedRange

    return {
        longitude: position.longitude,
        latitude:  position.latitude,
        height:    position.height,
        heading:   finiteNumber(position.heading) ?? lgs.settings.camera.heading,
        pitch:     finiteNumber(position.pitch) ?? lgs.settings.camera.pitch,
        roll:      finiteNumber(position.roll) ?? lgs.settings.camera.roll,
        range:     computedRange ?? lgs.settings.camera.range,
    }
}

const cameraStoreForTarget = (target, position = {}) => ({
    target:   {
        longitude:       target.longitude,
        latitude:        target.latitude,
        height:          target.height,
        simulatedHeight: target.simulatedHeight,
    },
    position: cameraPositionWithDefaults(position, target),
})

const starterCameraStore = starter => cameraStoreForTarget(starter)

const journeyCentroidCameraStore = async journey => {
    if (!journey?.tracks?.size) {
        return null
    }

    const centroid = await __.ui.sceneManager.getJourneyCentroid(journey)
    if (!centroid) {
        return null
    }

    return {
        focusTarget: journey,
        cameraStore: cameraStoreForTarget(new MapTarget(CURRENT_JOURNEY, {
            ...centroid,
            id: journey.slug,
        })),
    }
}

const fallbackCameraConfiguration = async (lgs, starter) => {
    const journeyConfiguration = await journeyCentroidCameraStore(lgs.theJourney)
    return journeyConfiguration ?? {
        focusTarget: starter,
        cameraStore: starterCameraStore(starter),
    }
}

const lastCameraConfiguration = async (lgs, starter) => {
    const savedCamera = await __.ui.cameraManager.readCameraInformation({fallback: false})
    if (cameraPositionIsValid(savedCamera?.position)) {
        const savedTargetIsValid = cameraTargetIsValid(savedCamera)
        const fallbackConfiguration = savedTargetIsValid ? null : await fallbackCameraConfiguration(lgs, starter)
        const target = savedTargetIsValid ? savedCamera.target : fallbackConfiguration.cameraStore.target

        return {
            focusTarget: savedTargetIsValid ? null : fallbackConfiguration.focusTarget,
            cameraStore: {
                restoreCameraPosition: true,
                target:                target,
                position:              cameraPositionWithDefaults(savedCamera.position, savedTargetIsValid ? savedCamera.target : {}),
            },
        }
    }

    return fallbackCameraConfiguration(lgs, starter)
}

const configureCamera = async (lgs, starter) => {
    if (__.ui.cameraManager.isAppFocusOn(FOCUS_LAST)) {
        return lastCameraConfiguration(lgs, starter)
    }

    if (__.ui.cameraManager.isAppFocusOn(FOCUS_CENTROID)) {
        return fallbackCameraConfiguration(lgs, starter)
    }

    if (__.ui.cameraManager.isAppFocusOn(FOCUS_STARTER) && !lgs.theJourney) {
        return {
            focusTarget: starter,
            cameraStore: starterCameraStore(starter),
        }
    }

    return fallbackCameraConfiguration(lgs, starter)
}

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

const waitForAppSurfaceReady = () => new Promise(resolve => {
    const scene = lgs?.scene
    const globe = scene?.globe

    if (!scene) {
        nextFrame().then(resolve)
        return
    }

    let done = false
    let stableFrames = 0
    let lastQueueLength = null
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

    const isLoaded = queueLength => {
        const queueReady = !Number.isFinite(queueLength) || queueLength === 0
        return queueReady && globe?.tilesLoaded !== false
    }

    const check = queueLength => {
        if (done) {
            return
        }

        if (Number.isFinite(queueLength)) {
            lastQueueLength = queueLength
        }

        if (isLoaded(lastQueueLength)) {
            stableFrames += 1
        }
        else {
            stableFrames = 0
        }

        if (stableFrames >= APP_SURFACE_READY_STABLE_FRAMES) {
            finish()
            return
        }

        scene.requestRender?.()
    }

    cleanup.push(scene.postRender.addEventListener(() => check(lastQueueLength)))

    if (globe?.tileLoadProgressEvent) {
        cleanup.push(globe.tileLoadProgressEvent.addEventListener(queueLength => check(queueLength)))
    }

    scene.requestRender?.()
    nextFrame().then(() => {
        scene.requestRender?.()
        check(lastQueueLength)
    })
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
     * Sets the camera focus and dispatches initialization event
     * @param {LGS1920Context} lgs - The application context
     * @param {Object} starter - The starter POI
     * @param {Object} focusTarget - The focus target
     * @param {Object} cameraStore - The camera settings
     */
    const setCameraFocus = (lgs, starter, focusTarget, cameraStore) => {
        const restoreCameraPosition = cameraStore.restoreCameraPosition === true
        __.ui.sceneManager.focus(cameraStore.target, {
            target:   focusTarget,
            heading:  cameraStore.position.heading,
            pitch:          !restoreCameraPosition && __.ui.sceneManager.noRelief() ? -90 : cameraStore.position.pitch,
            roll:     cameraStore.position.roll,
            range:    cameraStore.position.range,
            infinite: true,
            rotate: lgs.settings.ui.camera.start.rotate.app,
            lookAt:   true,
            cameraPosition: restoreCameraPosition ? cameraStore.position : null,
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
    }, [])
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
