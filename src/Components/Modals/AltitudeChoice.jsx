import { SlButton, SlDialog }   from '@shoelace-style/shoelace/dist/react'
import { forwardRef, useState } from 'react'
import { useSnapshot }          from 'valtio'

import '../../../assets/css/modals.css'
import { NO_DEM_SERVER }        from '../../../core/Journey'
import { DEMServerSelection }   from '../VT3D_UI/DEMServerSelection'


export const AltitudeChoice = forwardRef(function AltitudeChoice() {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const storeEditor = vt3d.theJourneyEditorProxy
    const snapEditor = useSnapshot(storeEditor)

    const [server, setServer] = useState(vt3d?.mainProxy.theJourney?.DEMServer ?? NO_DEM_SERVER)

    const setOpen = (open) => {
        mainStore.modals.altitudeChoice.show = open
    }

    /**
     * Allow altitudes simulation by setting the DEM server
     *
     * @param event
     */
    const allowAltitudeSimulation = async event => {
        if (isOK(event)) {
            setServer(event.target.value)
            event.preventDefault()
        }
    }

    /**
     * When the dialog is closed we add some tasks
     *
     * - simulate
     * - compute lmetrics
     * - notify user
     *
     * @param event
     * @return {Promise<void>}
     */
    const closeDialog = async (event) => {
        if (isOK(event)) {
            event.preventDefault()
            vt3d.theJourney.DEMServer = server
            if (server !== NO_DEM_SERVER) {
                await vt3d.theJourney.computeAll()
                vt3d.theJourney.addToContext()
                // Then we redraw the theJourney
                await vt3d.theJourney.showAfterHeightSimulation()
            }
        }
    }
    return (
        <> {snapEditor.track &&

            <SlDialog open={snap.modals.altitudeChoice.show}
                      style={{'--width': '50vw'}}
                      onSlHide={closeDialog}
            >

                <div slot="label">
                    Let's get a bit of altitude !
                </div>
                <div className="dialog-columns">
                    <div className={'dialog-text'}>
                        We have detected that your file does not contain altitude information.<br/>
                        That's okay, at worst you won't get some of the information,
                        but you can also simulate them !<br/>
                    </div>
                    <div className="dialog-action">
                        <DEMServerSelection
                            default={snapEditor.track.DEMServer ?? NO_DEM_SERVER}
                            label={'Choose the way you wish to obtain altitude:'}
                            onChange={allowAltitudeSimulation}/>
                    </div>
                </div>
                <SlButton slot="footer" variant="primary" onClick={() => setOpen(false)}>
                    Continue
                </SlButton>
            </SlDialog>
        }
        </>
    )
})