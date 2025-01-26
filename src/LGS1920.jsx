import { MapLayer } from '@Components/cesium/MapLayer'
import { Viewer }   from '@Components/cesium/Viewer'

import { InitErrorMessage }                                from '@Components/InitErrorMessage'
import { AllPOIs }                                         from '@Components/MainUI/AllPOIs'
import { MainUI }                                          from '@Components/MainUI/MainUI.jsx'
import '@shoelace-style/shoelace/dist/themes/light.css'
import { StarterPOI }                                      from '@Components/MainUI/StarterPOI'
import { WelcomeModal }                                    from '@Components/MainUI/WelcomeModal'
import { BASE_ENTITY, BOTTOM, MOBILE_MAX, OVERLAY_ENTITY } from '@Core/constants'
import { LGS1920Context }                                  from '@Core/LGS1920Context'
import { LayersAndTerrainManager }                         from '@Core/ui/LayerAndTerrainManager'
import { TerrainUtils }                                    from '@Utils/cesium/TerrainUtils'
import { TrackUtils }                                      from '@Utils/cesium/TrackUtils'
import { UIToast }                                         from '@Utils/UIToast'
import { useEffect }                                       from 'react'
import { useMediaQuery }                                   from 'react-responsive'

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
    lgs.initManagers()

    // Init Layer
    __.layersAndTerrainManager = new LayersAndTerrainManager()

}

export function LGS1920() {

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

                // Set the right terrain
                TerrainUtils.changeTerrain(lgs.settings.layers.terrain)

                // Set body class to manage css versus platform
                document.body.classList.add(lgs.platform);

                (async () => {
                    // Read DB
                    await TrackUtils.readAllFromDB()
                    console.log(`LGS1920 ${lgs.versions.studio} has been loaded and is ready on ${lgs.platform} platform !`)
                    console.log(`Connected to backend ${lgs.versions.backend}.`)
                })()

            }
            else {
                // Init was wrong, let'stop here
                UIToast.error({
                                  caption: `LGS1920 was stopped due to init errors!`,
                                  text:    `We're sorry`,
                              })
                console.log('LGS1920 was stopped due to init errors!')
                console.error(initApp.error)
            }
        }
        catch (error) {
            UIToast.error({
                              caption: `LGS1920 was stopped due to errors!`,
                              text:    `We're sorry`,
                          })
            console.log('LGS1920 was stopped due to errors!')
            console.error(error)
        }
    }, [])
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

                    <StarterPOI/>
                    <AllPOIs/>

                </>

            }
        </>
    )
}