import { faPaintbrushPencil, faScrewdriverWrench }                    from '@fortawesome/pro-regular-svg-icons'
import { faCircleUser }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlDrawer, SlIcon, SlTab, SlTabGroup, SlTabPanel, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import React                                                          from 'react'
import { useSnapshot }                                                from 'valtio'
import './style.css'
import { SETTINGS_EDITOR_DRAWER } from '@Core/constants'
import { FA2SL }                  from '@Utils/FA2SL'
import { DrawerFooter }                                               from '../DrawerFooter'
import { GeneralTools }                                               from './tools/general/GeneralTools'
import { ProfileTools }                                               from './tools/profile/ProfileTools'
import { Style }                                                      from './tools/style/Style'

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

                    <SlTab slot="nav" panel="tab-user" id={'manage-user-profile'}>
                        <SlTooltip placement={'top'} hoist content={'Manage My Profile'}>
                            <SlIcon library="fa" name={FA2SL.set(faCircleUser)}/>
                        </SlTooltip>
                    </SlTab>

                    <SlTabPanel name="tab-tools"><GeneralTools/></SlTabPanel>
                    <SlTabPanel name="tab-ui"><Style/></SlTabPanel>
                    <SlTabPanel name="tab-user" open><ProfileTools/></SlTabPanel>
                </SlTabGroup>
                <DrawerFooter/>

            </SlDrawer>

        </div>
    )
}
