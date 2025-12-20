/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-20
 * Last modified: 2025-12-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/


import { POIS_EDITOR_DRAWER, WIDGETS_CONFIGURATION, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import { SlDrawer, SlIcon }                                                 from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                            from '@Utils/FA2SL'
import { useCallback, useEffect, useState }                                 from 'react'
import { useSnapshot }                                                      from 'valtio'
import DrawerFooter                                                         from '../../../DrawerFooter'
import './style.css'

/**
 * A memoized React component for rendering the Points of Interest (POI) editor panel.
 * @returns {JSX.Element} The rendered drawer panel
 */
export const Panel = () => {

    const $video = lgs.stores.ui.video
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const drawerOpen = drawers.open === WIDGETS_EDITOR_DRAWER && $video.editing

    const menuSettings = useSnapshot(lgs.editorSettingsProxy.menu)
    const drawerPlacement = menuSettings.drawer

    const [widget, setWidget] = useState(null)
    const [data, setData] = useState({})

    /**
     * Cleans up and closes the widgets editor drawer.
     * @returns {void}
     */
    const closeEditor = useCallback(() => {
                                        // Only proceed if this specific drawer is currently open
                                        if (__.ui.drawerManager.isCurrent(WIDGETS_EDITOR_DRAWER)) {
                                            __.ui.drawerManager.close()
                                        }
                                        // Dispatch resize event (keep only if mandatory for scene/layout refresh)
                                        window.dispatchEvent(new Event('resize'))
                                    }
        , [])

    /**
     * Handles the sl-request-close event from <SlDrawer>.
     * Prevents closing if the source is 'overlay' (e.g., click outside) but allows close button/Esc.
     * @param {CustomEvent} event - Shoelace sl-request-close event
     * @returns {void}
     */
    const handleRequestClose = useCallback((event) => {
                                               // Prevent closing if the user clicks outside the drawer (overlay)
                                               if (event.detail.source === 'overlay') {
                                                   event.preventDefault()
                                               }
                                               else {
                                                   // Allow closing via internal mechanism (e.g., Esc key, internal
                                                   // close button)
                                                   closeEditor()
                                               }
                                           }
        , [closeEditor])
    useEffect(() => {
        if (drawers.entity) {
            const type = drawers.entity.split('#')[0]
            const cached = lgs.stores.ui.widget.cache.get(drawers.entity)
            const theWidget = __.widgets.get(cached.group).widgets.get(type)
            setData({
                        type:        type,
                        name:        theWidget.name,
                        description: theWidget.description,
                        icon:        FA2SL.set(WIDGETS_CONFIGURATION.get(type)?.icon),
                    })
            setWidget(__.ui.widgetManager.getWidgetPosition(drawers.entity))
        }
    }, [drawers.entity])

    if (!drawerOpen || !widget) {
        __.ui.drawerManager.close()
        return null
    }
    return (
        <>
            {drawerOpen && widget &&
                <div className="drawer-wrapper">
                    <SlDrawer
                        id={WIDGETS_EDITOR_DRAWER}
                        open={true}
                        className="lgs-theme"
                        placement={drawerPlacement}
                        onSlRequestClose={handleRequestClose}
                        onSlAfterHide={closeEditor}
                        contained
                    >
                            <span slot="label">
                                <SlIcon
                                    library="fa"
                                    name={data.icon}
                                />
                                {data.name}
                            </span>
                        <DrawerFooter/>
                    </SlDrawer>
                </div>
            }
        </>
    )
}