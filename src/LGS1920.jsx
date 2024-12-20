import { MapLayer }                    from '@Components/cesium/MapLayer'
import { Viewer }                      from '@Components/cesium/Viewer'
import { InitErrorMessage }            from '@Components/InitErrorMessage'
import { MainUI }                      from '@Components/MainUI/MainUI.jsx'
import '@shoelace-style/shoelace/dist/themes/light.css'
import { WelcomeModal }                from '@Components/MainUI/WelcomeModal'
import { BASE_ENTITY, OVERLAY_ENTITY } from '@Core/constants'
import { LayersAndTerrainManager }     from '@Core/layers/LayerAndTerrainManager'
import { LGS1920Context }              from '@Core/LGS1920Context'
import { TerrainUtils }                from '@Utils/cesium/TerrainUtils'
import { TrackUtils }                  from '@Utils/cesium/TrackUtils'
import { UIToast }                     from '@Utils/UIToast'
import { useEffect }                   from 'react'

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
                    //Ready
                    UIToast.success({
                                        caption: `Welcome on ${lgs.configuration.applicationName}!`,
                                        text:    'We\'re ready to assist you !',
                                    })
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
                    {/* */}

                </>

            }
        </>
    )
}