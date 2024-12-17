import { DrawerFooter }                            from '@Components/DrawerFooter'
import { SlDrawer, SlTab, SlTabGroup, SlTabPanel } from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useRef }                from 'react'
import { useSnapshot }                             from 'valtio'
import './style.css'
import { INFO_DRAWER } from '@Core/constants'

import { CreditsPanel } from './CreditsPanel'
import { WhatsNew }     from './WhatsNew'

export const Panel = () => {
    const snap = useSnapshot(lgs.mainProxy.drawers)
    const drawerRef = useRef(null)

    const closePanel = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(INFO_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
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


    return <div className={'drawer-wrapper'}>
        <SlDrawer id={INFO_DRAWER}
                  open={snap.open === INFO_DRAWER}
                  onSlRequestClose={closePanel}
                      ref={drawerRef}
                      contained
                      className={'lgs-theme'}
            >
                <SlTabGroup>
                    <SlTab slot="nav" panel="tab-whats-new">
                        What's New ?
                    </SlTab>
                    <SlTab slot="nav" panel="tab-credits">
                        Credits
                    </SlTab>
                    <SlTabPanel name="tab-credits">
                        <CreditsPanel/>
                    </SlTabPanel>
                    <SlTabPanel name="tab-whats-new">
                        <WhatsNew/>
                    </SlTabPanel>
                </SlTabGroup>

                <DrawerFooter/>

            </SlDrawer>

        </div>
}
