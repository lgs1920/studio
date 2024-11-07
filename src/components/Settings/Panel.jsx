import { SlDrawer, SlTabGroup }     from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useRef } from 'react'
import { useSnapshot }              from 'valtio'
import './style.css'
import { DrawerFooter }             from '../DrawerFooter'

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

    return (<div className={'drawer-wrapper'}>
            <SlDrawer id="settings-pane"
                      open={settingsPanel.visible}
                      onSlAfterHide={togglePanelVisibility}
                      ref={drawerRef}
                      contained
                      className={'lgs-theme'}>
                <SlTabGroup>
                </SlTabGroup>
                <DrawerFooter/>

            </SlDrawer>

        </div>
    )
}
