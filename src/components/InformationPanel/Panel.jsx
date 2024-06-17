import { DrawerFooter }             from '@Components/DrawerFooter'
import {
    faCircleInfo,
}                                   from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDrawer, SlIcon, SlTab, SlTabGroup, SlTabPanel, SlTooltip,
}                                   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                    from '@Utils/FA2SL'
import React, { useEffect, useRef } from 'react'
import { useSnapshot }              from 'valtio'
import './style.css'

import { CreditsPanel } from './CreditsPanel'
import { WhatsNew }     from './WhatsNew'

export const Panel = () => {

    const mainSnap = useSnapshot(lgs.mainUIStore)
    const drawerRef = useRef(null)

    const setOpen = (open) => {
        lgs.mainUIStore.credits.show = open
    }

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

    return (<>
        <SlDrawer id="info-pane"
                  open={mainSnap.credits.show}
                  onSlAfterHide={() => setOpen(false)}
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
        <SlTooltip hoist placement={'right'} content="Show Information">
            <SlButton className={'square-icon'} size="small" id={'open-info-pane'} onClick={() => setOpen(true)}>
                <SlIcon library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
}
