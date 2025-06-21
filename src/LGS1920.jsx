/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-21
 * Last modified: 2025-06-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapLayer } from '@Components/cesium/MapLayer'
import { Viewer }   from '@Components/cesium/Viewer'

import { InitErrorMessage }        from '@Components/InitErrorMessage'
import { MainUI }                  from '@Components/MainUI/MainUI.jsx'
import '@shoelace-style/shoelace/dist/themes/light.css'
import { SelectionIndicator }      from '@Components/MainUI/SelectionIndicator'
import { WelcomeModal }            from '@Components/MainUI/WelcomeModal'
import {
    APP_EVENT, BASE_ENTITY, BOTTOM, CURRENT_JOURNEY, FOCUS_LAST, FOCUS_STARTER, MOBILE_MAX, OVERLAY_ENTITY,
    POI_STARTER_TYPE,
}                                  from '@Core/constants'
import { LGS1920Context }          from '@Core/LGS1920Context'
import { MapTarget }               from '@Core/MapTarget'
import { LayersAndTerrainManager } from '@Core/ui/LayerAndTerrainManager'
import { TerrainUtils }            from '@Utils/cesium/TerrainUtils'
import { TrackUtils }              from '@Utils/cesium/TrackUtils'
import { UIToast }                 from '@Utils/UIToast'
import { useEffect }               from 'react'
import { useMediaQuery }           from 'react-responsive'

/***************************************
 * Init Application context
 */
window.lgs = new LGS1920Context()

// Application initialisation
const initApp = await __.app.init()

// If Init is OK, we have some additional tasks to do.

if (initApp.status) {
    // Set DefaultTheme
    __.app.setTheme()

    // Init UI managers
    await lgs.initManagers()

    // Init Layer
    __.layersAndTerrainManager = new LayersAndTerrainManager()

    // Read last camera position
    //  lgs.cameraStore = await __.ui.cameraManager.readCameraInformation()
}


export function LGS1920() {
    const $pois = lgs.stores.main.components.pois
    const isMobile = useMediaQuery({maxWidth: MOBILE_MAX})

    if (isMobile) {
        document.body.classList.add('mobile')
        lgs.editorSettingsProxy.menu.drawer = BOTTOM
    }
    else {
        document.body.classList.remove('mobile')
    }

    const isPortrait = useMediaQuery({orientation: 'portrait'})
    if (isPortrait) {
        document.body.classList.add('portrait')
    }
    else {
        document.body.classList.remove('portrait')
    }
    useEffect(() => {
                  try {
                      // If initialisation phase was OK, we have somme additional tasks to do.
                      if (initApp.status) {

                          // Detect drawer over
                          __.ui.drawerManager.attachEvents()

                          // Set body class to manage css versus platform
                          document.body.classList.add(lgs.platform);

                          (async () => {

                              // Set the right terrain
                              await TerrainUtils.changeTerrain(lgs.settings.layers.terrain)

                              // Read DB for journeys
                              await TrackUtils.readAllFromDB()

                              // Read DB for POIs
                              const initPOIManager = async () => {
                                  await __.ui.poiManager.initialize()
                              }
                              initPOIManager()
                              await __.ui.poiManager.readAllFromDB()

                              let starter = __.ui.poiManager.starter

                              let focusTarget = null

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

                              $pois.current = starter.id

                              // According to the settings and saved information, we set the camera data

                              // Use app settings
                              if (!lgs.theJourney) {
                                  __.ui.cameraManager.reset()
                              }

                              if (__.ui.cameraManager.isAppFocusOn(FOCUS_STARTER)) {
                                  focusTarget = starter
                                  lgs.cameraStore = {
                                      target: {
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
                                  // Last Camera Position
                                  lgs.cameraStore = await __.ui.cameraManager.readCameraInformation()
                              }
                              else {
                                  // App settings is last journey so what kind of focus ?
                                  if (__.ui.cameraManager.isJourneyFocusOn(FOCUS_LAST)) {
                                      //  Last Camera Position. On start, it is the same, whatever the journey
                                      lgs.cameraStore = await __.ui.cameraManager.readCameraInformation()
                                  }
                                  else {
                                      // Centroid
                                      focusTarget = lgs.theJourney
                                      lgs.cameraStore = lgs.theJourney.camera
                                      lgs.cameraStore.target = new MapTarget(CURRENT_JOURNEY, await __.ui.sceneManager.getJourneyCentroid(lgs.theJourney))
                                  }
                              }

                              // Do Focus
                              __.ui.sceneManager.focus(lgs.cameraStore.target, {
                                  target: focusTarget,
                                  heading:  lgs.cameraStore.position.heading,
                                  pitch:    __.ui.sceneManager.noRelief() ? -90 : lgs.cameraStore.position.pitch,
                                  roll:     lgs.cameraStore.position.roll,
                                  range:    lgs.cameraStore.position.range,
                                  infinite: true,
                                  rotate:   lgs.settings.ui.camera.start.rotate.app,
                                  lookAt:   true,
                                  rpm:      lgs.settings.starter.camera.rpm,
                                  callback: (point) => {
                                      const initEvent = new CustomEvent(APP_EVENT.INITIAL_FOCUS, {
                                          detail: {
                                              point:     point,
                                              timestamp: Date.now(),
                                          },
                                      })
                                      window.dispatchEvent(initEvent)
                                  },
                              })

                              // set animated state
                              starter.animated = lgs.settings.ui.camera.start.rotate.app

                              // log starting information
                              console.log(`LGS1920 ${lgs.versions.studio} has been loaded and is ready on ${lgs.platform} platform !`)
                              console.log(`Connected to backend ${lgs.versions.backend}.`)

                              // UI init
                              __.app.uiInit = true
                          })()


                      }
                      else {
                          // Init was wrong, let'stop here
                          UIToast.error({
                                            caption: `LGS1920 was stopped due to init errors!`,
                                            text:    `We're sorry`,
                                        })
                          console.log('LGS1920 was stopped due to init errors!')
                          console.error(initApp)
                      }
                  }
                  catch
                      (error) {
                      UIToast.error({
                                        caption: `LGS1920 was stopped due to errors!`,
                                        text:    `We're sorry`,
                                    })
                      console.log('LGS1920 was stopped due to errors!')
                      console.error(error)
                  }
              }

        ,
              [],
    )
    return (
        <>


            {
                !initApp.status && <InitErrorMessage message={initApp.error.message}/>
            }
            {
                initApp.status &&
                <>
                    <WelcomeModal/>
                    <MapLayer type={BASE_ENTITY}/>
                    <MapLayer type={OVERLAY_ENTITY}/>

                    <Viewer/>

                    <MainUI/>
                    <SelectionIndicator/>
                </>

            }
        </>
    )
}