import {SlButton, SlDialog}   from '@shoelace-style/shoelace/dist/react'
import {forwardRef, useState} from 'react'
import {useSnapshot}          from 'valtio'

import '../../../assets/css/modals.css'
import {NO_DEM_SERVER}        from '../../../classes/Track'
import {DEMServerSelection}   from '../TrackFileLoaderUI/DEMServerSelection'


export const AltitudeChoice = forwardRef(function AltitudeChoice() {

    const store = vt3d.store
    const snap = useSnapshot(store)
    const [server, setServer] = useState(vt3d?.currentTrack?.DEMServer ?? NO_DEM_SERVER)

    const setOpen = (open) => {
        store.modals.altitudeChoice.show = open
    }

    /**
     * Let's simulate altitudes if we have a DEM Server
     * @param event
     */
    const simulateAltitudes = async event => {
        switch (event.target.localName) {
            case 'sl-select':
                // We're coming from the selection,just put the value aside
                setServer(event.target.value)
                event.preventDefault()
                setOpen(true)
                break
            case 'sl-dialog':
                // It comes from the dialog so we validate the selection and simulates altitudes
                vt3d.track.DEMServer = server
                if (server !== NO_DEM_SERVER) {
                    await vt3d.track.computeAll()
                    vt3d.track.addToContext()
                    // Then we redraw the track
                    await vt3d.track.showAfterHeightSimulation()
                }
        }


    }
    return (
        <> {snap.currentTrack &&

            <SlDialog open={snap.modals.altitudeChoice.show}
                      style={{'--width': '50vw'}}
                      onSlHide={simulateAltitudes}
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
                            default={snap.currentTrack.DEMServer ?? NO_DEM_SERVER}
                            label={'Choose the way you wish to obtain altitude:'}
                            onChange={simulateAltitudes}/>
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