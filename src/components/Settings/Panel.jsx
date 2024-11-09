import { faTriangleExclamation }     from '@fortawesome/pro-solid-svg-icons'
import { SlAlert, SlDrawer, SlIcon } from '@shoelace-style/shoelace/dist/react'
import React                         from 'react'
import { useSnapshot }               from 'valtio'
import './style.css'
import { SETTINGS_EDITOR_DRAWER }    from '../../core/constants'
import { FA2SL }                     from '../../Utils/FA2SL'
import { DrawerFooter }              from '../DrawerFooter'

export const Panel = () => {
    const drawers = useSnapshot(lgs.mainProxy.drawers)
    const openInfoModal = () => lgs.editorSettingsProxy.layer.infoDialog = true

    const closePanel = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(SETTINGS_EDITOR_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }

    return (<div className={'drawer-wrapper'}>
            <SlDrawer id="settings-pane"
                      open={drawers.open === SETTINGS_EDITOR_DRAWER}
                      onSlRequestClose={closePanel}
                      contained
                      className={'lgs-theme'}>
                <SlAlert variant="warning" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                    {'Sorry, there\'s nothing to see here right now!'}
                </SlAlert>
                {/* <SlTabGroup> */}
                {/* </SlTabGroup> */}
                <DrawerFooter/>

            </SlDrawer>

        </div>
    )
}
