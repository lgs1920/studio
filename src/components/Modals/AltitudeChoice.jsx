import { ElevationServer.NONE }        from '@Core/Journey'
import { SlButton, SlDialog }   from '@shoelace-style/shoelace/dist/react'
import { forwardRef, useState } from 'react'
import { useSnapshot }          from 'valtio'

import '../../../assets/css/modals.css'
import { SelectElevationSource } from '../MainUI/SelectElevationSource'


export const AltitudeChoice = forwardRef(function AltitudeChoice() {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const storeEditor = lgs.theJourneyEditorProxy
    const snapEditor = useSnapshot(storeEditor)

    const [server, setServer] = useState(lgs?.mainProxy.theJourney?.elevationServer ?? ElevationServer.NONE)

    const setOpen = (open) => {
        mainStore.modals.altitudeChoice.show = open
    }

    /**
     * Allow altitudes simulation by setting the DEM server
     *
     * @param event
     */
    const allowAltitudeSimulation = async event => {
        if (window.isOK(event)) {
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
        if (window.isOK(event)) {
            event.preventDefault()
            lgs.theJourney.elevationServer = server
            if (server !== ElevationServer.NONE) {
                await lgs.theJourney.extractMetrics()
                lgs.saveJourney()
                lgs.theJourney.addToContext()
                // Then we redraw the theJourney
                await lgs.theJourney.showAfterHeightSimulation()
            }
        }
    }
    return (
        <> {snapEditor.track &&

            <SlDialog open={snap.modals.altitudeChoice.show}
                      style={{'--width': '50vw'}}
                      onSlHide={closeDialog}
                      className={'lgs-theme'}
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
                        <SelectElevationSource
                            default={snapEditor.track.elevationServer ?? ElevationServer.NONE}
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