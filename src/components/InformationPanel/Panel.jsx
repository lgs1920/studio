/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *  
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-18
 * Last modified: 2026-03-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter                                  from '@Components/DrawerFooter'
import PanelActions from '@Components/PanelsActions'
import ThemeSelector from '@Components/ThemeSelector'
import WaDrawer                                      from '@Components/WaDrawerNonModal'
import { INFO_DRAWER }                               from '@Core/constants'
import { WaScroller, WaTab, WaTabGroup, WaTabPanel } from '@web.awesome.me/webawesome-pro/dist/react'

import React, { useEffect, useRef } from 'react'
import { createPortal }             from 'react-dom'
import { useSnapshot }              from 'valtio'
import './style.css'

import { CreditsPanel } from './CreditsPanel'
import { WhatsNew }     from './WhatsNew'

export const Panel = () => {
    const snap = useSnapshot(lgs.stores.ui.drawers)
    const _drawerRef = useRef(null)

    const closePanel = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(INFO_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }

    /**
     * Handles external link injection in WaDrawer
     * @param {Event} event - The slotchange event
     */
    const _handleSlotChange = (event) => {
        const _slot = event.target
        const _elements = _slot.assignedElements()

        if (_elements.length > 0) {
            _elements[0].querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank')
            })
        }
    }

    useEffect(() => {
        if (_drawerRef.current) {
            // Find the slot element inside the Shadow DOM
            const _slot = _drawerRef.current.shadowRoot.querySelector('slot[name="body"]') ||
                _drawerRef.current.shadowRoot.querySelector('slot:not([name])')

            if (_slot) {
                _slot.addEventListener('slotchange', _handleSlotChange)
            }
        }

        /**
         * Cleanup function to prevent memory leaks
         */
        return () => {
            const _slot = _drawerRef.current?.shadowRoot.querySelector('slot')
            _slot?.removeEventListener('slotchange', _handleSlotChange)
        }
    }, [])


    const drawerRoot = __.ui.drawerManager.drawerRoot

    const content = (
        <WaDrawer id={INFO_DRAWER}
                  open={snap.open === INFO_DRAWER}
                  onWaAfterHide={closePanel}
                  ref={_drawerRef}
                  lightDismiss
                  placement={useSnapshot(lgs.editorSettingsProxy.menu).drawer}
        >
            <PanelActions/>
            <WaTabGroup>
                <WaTab slot="nav" panel="tab-whats-new">
                    What's New ?
                </WaTab>
                <WaTab slot="nav" panel="tab-credits">
                    Credits
                </WaTab>
                <WaTabPanel name="tab-credits">
                    <WaScroller orientation="vertical">
                        <CreditsPanel/>
                    </WaScroller>
                </WaTabPanel>
                <WaTabPanel name="tab-whats-new">
                        <WhatsNew/>
                </WaTabPanel>
            </WaTabGroup>

            <DrawerFooter/>

        </WaDrawer>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content


}
