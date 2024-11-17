import { faPaintbrushPencil, faScrewdriverWrench }         from '@fortawesome/pro-regular-svg-icons'
import { SlDrawer, SlIcon, SlTab, SlTabGroup, SlTabPanel } from '@shoelace-style/shoelace/dist/react'
import React                                               from 'react'
import { useSnapshot }                                     from 'valtio'
import './style.css'
import { SETTINGS_EDITOR_DRAWER }                          from '../../core/constants'
import { FA2SL }                                           from '../../Utils/FA2SL'
import { DrawerFooter }                                    from '../DrawerFooter'
import { Tools }                                           from './tools/Tools'

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
                <SlTabGroup>
                    <SlTab slot="nav" panel="tab-ui">
                        <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/> {'User Interface'}
                    </SlTab>
                    <SlTab slot="nav" panel="tab-tools">
                        <SlIcon library="fa" name={FA2SL.set(faScrewdriverWrench)}/> {'Tools'}
                    </SlTab>


                    <SlTabPanel name="tab-tools"><Tools/></SlTabPanel>
                    <SlTabPanel name="tab-ui">
                    </SlTabPanel>
                </SlTabGroup>
                <DrawerFooter/>

            </SlDrawer>

        </div>
    )
}
