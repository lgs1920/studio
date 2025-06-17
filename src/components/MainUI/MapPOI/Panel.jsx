/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-17
 * Last modified: 2025-06-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                           from 'valtio'
import { SlDrawer }                              from '@shoelace-style/shoelace/dist/react'
import { MapPOIEditSettings } from '@Components/MainUI/MapPOI/MapPOIEditSettings'
import { MapPOIList }                            from '@Components/MainUI/MapPOI/MapPOIList'
import { DrawerFooter }                          from '../../DrawerFooter'
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import { proxyMap } from 'valtio/utils'
import './style.css'

/**
 * A memoized React component for rendering the Points of Interest (POI) editor panel.
 * @returns {JSX.Element} The rendered drawer panel
 */
export const Panel = memo(() => {
    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore, {sync: true})
    const menu = useSnapshot(lgs.editorSettingsProxy.menu, {sync: true})

    // Memoized closePOIsEditor handler
    const closePOIsEditor = useCallback((event) => {
        if (window.isOK(event)) {
            if (__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
                __.ui.drawerManager.close()
            }
            // Avoid global resize event unless necessary
            // window.dispatchEvent(new Event('resize'))
        }
    }, [])

    // Memoized handleRequestClose handler
    const handleRequestClose = useCallback((event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            closePOIsEditor(event)
        }
    }, [closePOIsEditor])

    // Memoized categories calculation
    const categories = useMemo(() => {
        if (!lgs.settings.poi?.categories) {
            return new Map()
        }
        const catMap = new Map()
        Object.values(lgs.settings.poi.categories).forEach((category) => {
            if (category?.slug && category?.title) {
                catMap.set(category.slug, {
                    title: category.title,
                    slug:  category.slug,
                })
            }
        })
        return new Map(
            [...catMap.entries()].sort((a, b) =>
                                           a[1].title.toLowerCase().localeCompare(b[1].title.toLowerCase()),
            ),
        )
    }, [lgs.settings.poi?.categories])

    // Update categories in store only when they change
    useEffect(() => {
        mainStore.components.pois.categories = new proxyMap([...categories.entries()])
    }, [categories, mainStore.components.pois])

    return (
        <SlDrawer
            id={POIS_EDITOR_DRAWER}
            open={mainSnap.drawers.open === POIS_EDITOR_DRAWER}
            onSlRequestClose={handleRequestClose}
            onSlAfterHide={closePOIsEditor}
            contained
            className="lgs-theme"
            placement={menu.drawer}
            label="Points Of Interest"
        >
            <MapPOIEditSettings/>
            <MapPOIList context={'poi-panel'}/>
            <DrawerFooter/>
        </SlDrawer>
    )
})