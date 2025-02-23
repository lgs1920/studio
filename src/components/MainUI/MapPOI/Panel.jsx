/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-23
 * Last modified: 2025-02-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIEditSettings } from '@Components/MainUI/MapPOI/MapPOIEditSettings'
import { MapPOIList }         from '@Components/MainUI/MapPOI/MapPOIList'
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import { SlDrawer }           from '@shoelace-style/shoelace/dist/react'
import React                  from 'react'
import { useSnapshot }        from 'valtio'
import './style.css'
import { DrawerFooter }       from '../../DrawerFooter'

export const Panel = () => {
    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)
    const menu = useSnapshot(lgs.editorSettingsProxy.menu)

    const closePOIsEditor = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }
    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            closePOIsEditor(event)
        }
    }

    return (<div className={'drawer-wrapper'}>
            <SlDrawer id={POIS_EDITOR_DRAWER}
                      open={mainSnap.drawers.open === POIS_EDITOR_DRAWER}
                      onSlRequestClose={handleRequestClose}
                      contained
                      onSlAfterHide={closePOIsEditor}
                      className={'lgs-theme'}
                      placement={menu.drawer}
            >
                <MapPOIEditSettings/>
                <MapPOIList/>
                <DrawerFooter/>

            </SlDrawer>

        </div>
    )
}
