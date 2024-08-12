import { DrawerFooter }                            from '@Components/DrawerFooter'
import { SlDrawer, SlTab, SlTabGroup, SlTabPanel } from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useRef }                from 'react'
import { useSnapshot }                             from 'valtio'
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

    const togglePanelVisibility= (event) => {
        if (event.target !== 'sl-drawer' ) {
            event.preventDefault()
            return
        }
        infoPanelStore.visible = !infoPanelStore.visible
    }

    return (<>
        <SlDrawer id="info-pane"
                  open={infoPanel.visible}
                  onSlAfterHide={togglePanelVisibility}
                  ref={drawerRef}
                  className={'lgs-theme'}
        >
            <SlTabGroup>
                <SlTab slot="nav" panel="tab-whats-new">
                    What's New ?
                </SlTab>
                <SlTab slot="nav" panel="tab-credits">
                    Credits
                </SlTab>
                <SlTabPanel  name="tab-credits">
                    <CreditsPanel/>
                </SlTabPanel>
                <SlTabPanel  name="tab-whats-new">
                    <WhatsNew/>
                </SlTabPanel>
            </SlTabGroup>

            <DrawerFooter/>

        </SlDrawer>

        </>
    )
}
