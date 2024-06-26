import { DrawerFooter }             from '@Components/DrawerFooter'
import {
    faCircleInfo,
}                                   from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDrawer, SlIcon, SlTab, SlTabGroup, SlTabPanel, SlTooltip,
}                                   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                              from '@Utils/FA2SL'
import React, { useEffect, useRef, useState } from 'react'
import { useSnapshot }                        from 'valtio'
import './style.css'

import { CreditsPanel } from './CreditsPanel'
import { WhatsNew }     from './WhatsNew'

export const Panel = () => {
    const infoPanelStore= lgs.mainProxy.components.informationPanel
    const infoPanel = useSnapshot(infoPanelStore)
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

    const togglePanelVisibility= () =>infoPanelStore.visible = !infoPanelStore.visible

    return (<>
        <SlDrawer id="info-pane"
                  open={infoPanel.visible}
                  onSlAfterHide={togglePanelVisibility}
                  ref={drawerRef}
        >


            <SlTabGroup style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
                <SlTab slot="nav" panel="tab-whats-new">
                    What's New ?
                </SlTab>

                <SlTab slot="nav" panel="tab-credits">
                    Credits
                </SlTab>

                <SlTabPanel name="tab-credits"><CreditsPanel/></SlTabPanel>
                <SlTabPanel name="tab-whats-new"><WhatsNew/></SlTabPanel>
            </SlTabGroup>


            <DrawerFooter/>

        </SlDrawer>
        <SlTooltip hoist placement="right" content="Show Information">
            <SlButton className={'square-icon'} size="small" id={'open-info-pane'} onClick={togglePanelVisibility}>
                <SlIcon slot="prefix"library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
}
