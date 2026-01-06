/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIEditFilter }   from '@Components/MainUI/MapPOI/MapPOIEditFilter'
import { MapPOIEditSettings } from '@Components/MainUI/MapPOI/MapPOIEditSettings'
import { MapPOIEditToggleFilter } from '@Components/MainUI/MapPOI/MapPOIEditToggleFilter'
import { MapPOIList }         from '@Components/MainUI/MapPOI/MapPOIList'
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import { SlDrawer }           from '@shoelace-style/shoelace/dist/react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }        from 'valtio'
import { proxyMap }           from 'valtio/utils'
import DrawerFooter from '../../DrawerFooter'
import './style.css'

/**
 * A memoized React component for rendering the Points of Interest (POI) editor panel.
 * @returns {JSX.Element} The rendered drawer panel
 */
export const Panel = memo(() => {

    // --- VALTIO STATE ACCESS ---

    // POI Store Proxy ($pois) for mutable state operations
    const $pois = lgs.stores.main.components.pois

    // UI Drawers state snapshot for checking drawer status
    // Correction: Renamed from 'drawerState' to 'drawers' as per instructions (deepest attribute name)
    const drawers = useSnapshot(lgs.stores.ui.drawers)

    // Settings snapshots
    const menuSettings = useSnapshot(lgs.editorSettingsProxy.menu)
    const poiSettings = useSnapshot(lgs.settings.poi)

    // --- VARIABLES ---

    const drawerOpen = drawers.open === POIS_EDITOR_DRAWER // Use 'drawers' here
    const drawerPlacement = menuSettings.drawer

    // --- HANDLERS ---

    /**
     * Cleans up and closes the POIs editor drawer.
     * Assumes global function __.ui.drawerManager.close() handles the state mutation.
     * @returns {void}
     */
    const closePOIsEditor = useCallback(() => {
                                            // Only proceed if this specific drawer is currently open
                                            if (__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
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
                                                   closePOIsEditor()
                                               }
                                           }
        , [closePOIsEditor])

    // --- CATEGORY LOGIC ---

    /**
     * Calculates, filters, and sorts POI categories based on settings.
     * @returns {Map<string, {title: string, slug: string}>} A sorted map of valid categories
     */
    const categories = useMemo(() => {
                                   const catConfig = poiSettings?.categories

                                   if (!catConfig) {
                                       return new Map()
                                   }

                                   const validCategories = Object.values(catConfig).filter(category => category?.slug && category?.title)

                                   // Convert array to map for processing
                                   const catMap = new Map()
                                   validCategories.forEach(category => {
                                       catMap.set(category.slug, {
                                           title:  category.title
                                           , slug: category.slug,
                                       })
                                   })

                                   // Sort by title alphabetically (case-insensitive)
                                   return new Map(
                                       [...catMap.entries()].sort((a, b) =>
                                                                      a[1].title.toLowerCase().localeCompare(b[1].title.toLowerCase()),
                                       ),
                                   )
                               }
        , [poiSettings?.categories])

    /**
     * Updates the POI store's categories using Valtio's proxyMap when settings change.
     * @returns {void}
     */
    useEffect(() => {
                  // Use proxyMap to efficiently assign the new Map data to the Valtio proxy
                  $pois.categories = new proxyMap([...categories.entries()])
              }
        , [categories, $pois])


    return (
        <>
            {drawerOpen &&
                <div className="drawer-wrapper">
                    <SlDrawer
                        id={POIS_EDITOR_DRAWER}
                        open={true}
                        onSlRequestClose={handleRequestClose}
                        onSlAfterHide={closePOIsEditor}
                        contained
                        className="lgs-theme"
                        placement={drawerPlacement}
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
            }
        </>
    )
})