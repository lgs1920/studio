/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DrawerFooter }                            from '@Components/DrawerFooter'
import { INFO_DRAWER }                             from '@Core/constants'
import { SlDrawer, SlTab, SlTabGroup, SlTabPanel } from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useRef }                from 'react'
import { useSnapshot }                             from 'valtio'
import './style.css'

import { CreditsPanel } from './CreditsPanel'
import { WhatsNew }     from './WhatsNew'

export const Panel = () => {
    const snap = useSnapshot(lgs.stores.ui.drawers)
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
                  placement={useSnapshot(lgs.editorSettingsProxy.menu).drawer}
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
