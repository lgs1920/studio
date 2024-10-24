import { faLayerGroup }                                    from '@fortawesome/pro-solid-svg-icons'
import { SlDrawer, SlIcon, SlTab, SlTabGroup, SlTabPanel } from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useRef }                        from 'react'
import { useSnapshot }                                     from 'valtio'
import './style.css'
import { FA2SL }                                           from '../../Utils/FA2SL'
import { DrawerFooter }                                    from '../DrawerFooter'
import { LayersAndTerrains }                               from './layers/LayersAndTerrains'

export const Panel = () => {
    const settingsPanelStore = lgs.mainProxy.components.settings
    const settingsPanel = useSnapshot(settingsPanelStore)
    const drawerRef = useRef(null)

    useEffect(() => {
        //search the link and add external target (as it is not possible in markdown)
        if (drawerRef.current) {
            const slotBody = drawerRef.current.shadowRoot.querySelector('slot[part="body"]')
            const assignedElements = slotBody.assignedElements()
            assignedElements[0].querySelectorAll('a').forEach(link => {
                link.target = '_blank'
            })
        }

    }, [])

    const togglePanelVisibility = (event) => {
        if (event.target !== 'sl-drawer') {
            event.preventDefault()
            return
        }
        settingsPanelStore.visible = !settingsPanelStore.visible
    }

    return (<>
            <SlDrawer id="settings-pane"
                      open={settingsPanel.visible}
                      onSlAfterHide={togglePanelVisibility}
                      ref={drawerRef}
                      className={'lgs-theme'}>
                <SlTabGroup>
                    <SlTab slot="nav" panel="tab-layers">
                        <SlIcon library="fa" name={FA2SL.set(faLayerGroup)}/>{'Layers & Terrains'}
                    </SlTab>
                    <SlTab slot="nav" panel="tab-credits">
                    </SlTab>
                    <SlTabPanel name="tab-layers">
                        <LayersAndTerrains/>
                    </SlTabPanel>
                    <SlTabPanel name="tab-whats-new">
                    </SlTabPanel>
                </SlTabGroup>
                <DrawerFooter/>

            </SlDrawer>

        </>
    )
}
