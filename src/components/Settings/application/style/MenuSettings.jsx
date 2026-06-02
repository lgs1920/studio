/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MenuSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MenuSample }    from '@Components/Settings/application/style/MenuSample'
import {
    BOTTOM, DESKTOP_MIN, MENU_BOTTOM_END, MENU_BOTTOM_START, MENU_END_END, MENU_END_START, MENU_START_END,
    MENU_START_START, MOBILE_MAX, START,
}                        from '@Core/constants'
import { SlDivider }     from '@shoelace-style/shoelace/dist/react'
import { WaDivider } from '@web.awesome.me/webawesome-pro/dist/react'

export const MenuSettings = (props) => {

    const {ref} = props

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const selectDisposition = (event, name) => {
        const positions = name.split('-')
        if (__.device.isMobile) {
            lgs.settings.ui.menu.drawers.fromBottom = (positions[0] === BOTTOM)
            lgs.editorSettingsProxy.menu.drawer = positions[0]
        }
        else {
            lgs.settings.ui.menu.drawers.fromStart = (positions[0] === START)
            lgs.editorSettingsProxy.menu.drawer = positions[0]
        }

        lgs.settings.ui.menu.toolBar.fromStart = (positions[1] === START)
        lgs.editorSettingsProxy.menu.toolbar = positions[1]

        ref.current = true
        // Reset after event cycle
        setTimeout(() => {
            if (ref) {
                ref.current = false
            }
        }, 50)
    }


    return (
        <>
            <span slot="summary">{'Menu Settings'}</span>
            <WaDivider/>
            <div id="menu-disposition-chooser" device={__.device.isMobile ? 'mobile' : undefined}>
                {__.device.isMobile ? (
                    // Mobile menu options
                    <>
                        <MenuSample
                            align={MENU_BOTTOM_START}
                            onSelect={selectDisposition}
                            device="mobile"
                            tooltip="Panels on bottom, buttons on left"
                        />
                        <MenuSample
                            align={MENU_BOTTOM_END}
                            onSelect={selectDisposition}
                            device="mobile"
                            tooltip="Panels on bottom, buttons on right"
                        />
                    </>
                ) : (
                     // Non-mobile (tablet/desktop) menu options
                     <>
                         <MenuSample
                             align={MENU_START_END}
                             onSelect={selectDisposition}
                             tooltip="Panels on left, buttons on right"
                         />
                         <MenuSample
                             align={MENU_START_START}
                             onSelect={selectDisposition}
                             tooltip="Both panels and buttons on left"
                         />
                         <MenuSample
                             align={MENU_END_START}
                             onSelect={selectDisposition}
                             tooltip="Panels on right, buttons on left"
                         />
                         <MenuSample
                             align={MENU_END_END}
                             onSelect={selectDisposition}
                             tooltip="Both panels and buttons on right"
                         />
                     </>
                 )}
            </div>
        </>
    )
}