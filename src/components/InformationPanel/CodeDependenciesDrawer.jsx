/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CodeDependenciesDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import PanelActions from '@Components/PanelsActions'
import WaDrawer from '@Components/WaDrawerNonModal'
import { CODE_DEPENDENCIES_DRAWER } from '@Core/constants'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef } from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import { useSnapshot } from 'valtio'
import { markdown as dependencies } from '../../../tech-doc/specs/README_DEPENDENCIES.md'

/**
 * Renders the code dependencies drawer.
 *
 * @returns {JSX.Element}
 */
export const CodeDependenciesDrawer = () => {
    const snap = useSnapshot(lgs.stores.ui.drawers)
    const menu = useSnapshot(lgs.editorSettingsProxy.menu)
    const _drawerRef = useRef(null)
    const isStacked = __.ui.drawerManager.isStacked(CODE_DEPENDENCIES_DRAWER)

    /**
     * Closes the drawer with the drawer manager.
     */
    const closeDrawerWithManager = useCallback(() => {
        window.dispatchEvent(new Event('resize'))
        if (__.ui.drawerManager.isCurrent(CODE_DEPENDENCIES_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    /**
     * Closes the drawer after it hides.
     *
     * @param {Event} event - The drawer hide event
     */
    const closeDrawer = event => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(CODE_DEPENDENCIES_DRAWER)) {
            closeDrawerWithManager()
        }
    }

    useEffect(() => {
        const drawer = _drawerRef.current

        if (!drawer?.shadowRoot) {
            return undefined
        }

        const slot = drawer.shadowRoot.querySelector('slot[name="body"]')
                  || drawer.shadowRoot.querySelector('slot:not([name])')

        if (!slot) {
            return undefined
        }

        /**
         * Forces external links to open in a new tab.
         *
         * @param {Event} event - The slotchange event
         */
        const handleSlotChange = event => {
            const slotElement = event.target
            slotElement.assignedElements().forEach((element) => {
                element.querySelectorAll('a').forEach((link) => {
                    link.setAttribute('target', '_blank')
                    link.setAttribute('rel', 'noreferrer')
                })
            })
        }

        slot.addEventListener('slotchange', handleSlotChange)

        return () => {
            slot.removeEventListener('slotchange', handleSlotChange)
        }
    }, [])

    const drawerRoot = __.ui.drawerManager.drawerRoot

    const content = (
        <WaDrawer
            id={CODE_DEPENDENCIES_DRAWER}
            open={snap.open === CODE_DEPENDENCIES_DRAWER}
            onWaAfterHide={closeDrawer}
            ref={_drawerRef}
            className={isStacked ? 'drawer-is-stacked' : undefined}
            lightDismiss
            placement={menu.drawer}
        >
            <span slot="label">{'Code dependencies'}</span>
            <PanelActions stackedPanel={isStacked} onBack={isStacked ? closeDrawerWithManager : null}/>
            <LGSScrollbars>
                <WaCard className="lgs--license-document">
                    <section className="lgs--license-markdown">
                        <ReactMarkdown>{dependencies}</ReactMarkdown>
                    </section>
                </WaCard>
            </LGSScrollbars>
            <DrawerFooter/>
        </WaDrawer>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
}
