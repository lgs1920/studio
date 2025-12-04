/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-04
 * Last modified: 2025-12-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIEditFilter }       from '@Components/MainUI/MapPOI/MapPOIEditFilter'
import { MapPOIEditSettings }     from '@Components/MainUI/MapPOI/MapPOIEditSettings'
import { MapPOIEditToggleFilter } from '@Components/MainUI/MapPOI/MapPOIEditToggleFilter'
import { MapPOIList }             from '@Components/MainUI/MapPOI/MapPOIList'
import { POIS_EDITOR_DRAWER }     from '@Core/constants'
import { SlDrawer }               from '@shoelace-style/shoelace/dist/react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }            from 'valtio'
import { proxyMap }               from 'valtio/utils'
import DrawerFooter from '../../DrawerFooter'
import './style.css'

/**
 * A memoized React component for rendering the Points of Interest (POI) editor panel.
 * @returns {JSX.Element} The rendered drawer panel
 */
export const Panel = memo(() => {

    // --- Valtio State Access ---

    // 1. POI Store (Proxy) for mutation in useEffect
    const $pois = lgs.stores.main.components.pois

    // 2. UI Drawers state (Snapshot) for drawer 'open' prop
    const drawerState = useSnapshot(lgs.stores.ui.drawers)

    // 3. Settings (Snapshot) for drawer placement (menu) and categories (settings)
    const menuSettings = useSnapshot(lgs.editorSettingsProxy.menu)
    const poiSettings = useSnapshot(lgs.settings.poi)

    // --- Handlers ---

    /**
     * Cleans up and closes the POIs editor drawer.
     * Assumes global function __.ui.drawerManager.close() handles the state mutation.
     * @param {Event} [event] - Optional event object.
     */
    const closePOIsEditor = useCallback(() => {
        // Only close if this drawer is currently open to prevent recursive calls on sl-after-hide
        if (__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
        // Dispatch resize event only if needed by other components (keep if mandatory)
        window.dispatchEvent(new Event('resize'))
    }, []) // No external dependencies needed for closing global store state

    /**
     * Handles the sl-request-close event from <SlDrawer>.
     * Prevents closing if the source is 'overlay' (e.g., click outside) but allows the close button.
     * @param {CustomEvent} event - Shoelace sl-request-close event.
     */
    const handleRequestClose = useCallback((event) => {
        // Prevent closing if the user clicks outside the drawer (overlay)
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            // Allow closing via internal mechanism (e.g., Esc key, internal close button)
            closePOIsEditor()
        }
    }, [closePOIsEditor])

    // --- Category Logic ---

    /**
     * Calculates and sorts POI categories based on lgs.settings.poi.categories.
     */
    const categories = useMemo(() => {
        const catConfig = poiSettings?.categories // Use snapshot access

        if (!catConfig) {
            return new Map()
        }

        const catMap = new Map()

        Object.values(catConfig).forEach((category) => {
            if (category?.slug && category?.title) {
                // Ensure the map only stores necessary, validated data
                catMap.set(category.slug, {
                    title: category.title,
                    slug:  category.slug,
                })
            }
        })

        // Sort by title alphabetically (case-insensitive)
        return new Map(
            [...catMap.entries()].sort((a, b) =>
                                           a[1].title.toLowerCase().localeCompare(b[1].title.toLowerCase()),
            ),
        )
    }, [poiSettings?.categories]) // Depend only on the categories object structure

    /**
     * Updates the POI store's categories when the settings change.
     */
    useEffect(() => {
        // Use proxyMap for efficient assignment of Map data to a Valtio proxy
        $pois.categories = new proxyMap([...categories.entries()])
    }, [categories, $pois])


    return (
        <div className="drawer-wrapper">
            <SlDrawer
                id={POIS_EDITOR_DRAWER}
                open={drawerState.open === POIS_EDITOR_DRAWER}
                onSlRequestClose={handleRequestClose}
                onSlAfterHide={closePOIsEditor}
                contained
                className="lgs-theme"
                placement={menuSettings.drawer}
            >
                <>
                    <span slot="label">{'Points Of Interest'}</span>
                    <MapPOIEditToggleFilter/>
                    <MapPOIEditFilter/>
                    <MapPOIEditSettings/>
                    <MapPOIList/>
                    <DrawerFooter/>
                </>
            </SlDrawer>
        </div>
    )
})