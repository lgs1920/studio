/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *  
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter                                  from '@Components/DrawerFooter'
import PanelActions                        from '@Components/PanelsActions'
import WaDrawer                                      from '@Components/WaDrawerNonModal'
import { INFO_CHANGELOG_TAB, INFO_DRAWER } from '@Core/constants'
import { WaScroller, WaTab, WaTabGroup, WaTabPanel } from '@web.awesome.me/webawesome-pro/dist/react'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal }                from 'react-dom'
import { useSnapshot }                 from 'valtio'
import './style.css'

import { CreditsPanel } from './CreditsPanel'
import { ShortcutsPanel } from './ShortcutsPanel'
import { WhatsNew }     from './WhatsNew'

const INFO_SHORTCUTS_TAB = 'tab-shortcuts'

export const Panel = () => {
    const snap = useSnapshot(lgs.stores.ui.drawers)
    const _drawerRef = useRef(null)
    const [activeTab, setActiveTab] = useState(INFO_CHANGELOG_TAB)
    const isStacked = __.ui.drawerManager.isStacked(INFO_DRAWER)

    const closePanelWithManager = useCallback(() => {
        window.dispatchEvent(new Event('resize'))
        if (__.ui.drawerManager.isCurrent(INFO_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const closePanel = (event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(INFO_DRAWER)) {
            closePanelWithManager()
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
        const drawer = _drawerRef.current

        if (drawer) {
            // Find the slot element inside the Shadow DOM
            const _slot = drawer.shadowRoot.querySelector('slot[name="body"]') ||
                drawer.shadowRoot.querySelector('slot:not([name])')

            if (_slot) {
                _slot.addEventListener('slotchange', _handleSlotChange)
            }
        }

        /**
         * Cleanup function to prevent memory leaks
         */
        return () => {
            const _slot = drawer?.shadowRoot.querySelector('slot')
            _slot?.removeEventListener('slotchange', _handleSlotChange)
        }
    }, [])

    const handleTabShow = (event) => {
        setActiveTab(event.detail.name)
    }

    const visibleTab = snap.open === INFO_DRAWER
                       ? __.ui.drawerManager.tab ?? activeTab
                       : activeTab

    const drawerRoot = __.ui.drawerManager.drawerRoot

    const content = (
        <WaDrawer id={INFO_DRAWER}
                  open={snap.open === INFO_DRAWER}
                  onWaAfterHide={closePanel}
                  ref={_drawerRef}
                  className={isStacked ? 'drawer-is-stacked' : undefined}
                  lightDismiss
                  placement={useSnapshot(lgs.editorSettingsProxy.menu).drawer}
        >
            <PanelActions stackedPanel={isStacked} onBack={isStacked ? closePanelWithManager : null}/>
            <WaTabGroup onWaTabShow={handleTabShow}>
                <WaTab slot="nav" panel={INFO_CHANGELOG_TAB}>
                    What's New ?
                </WaTab>
                <WaTab slot="nav" panel={INFO_SHORTCUTS_TAB}>
                    Shortcuts
                </WaTab>
                <WaTab slot="nav" panel="tab-credits">
                    Credits
                </WaTab>
                <WaTabPanel name={INFO_SHORTCUTS_TAB}>
                    <ShortcutsPanel/>
                </WaTabPanel>
                <WaTabPanel name="tab-credits">
                    <WaScroller orientation="vertical">
                        <CreditsPanel/>
                    </WaScroller>
                </WaTabPanel>
                <WaTabPanel name={INFO_CHANGELOG_TAB}>
                    <WhatsNew visible={snap.open === INFO_DRAWER && visibleTab === INFO_CHANGELOG_TAB}/>
                </WaTabPanel>
            </WaTabGroup>

            <DrawerFooter/>

        </WaDrawer>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content


}
