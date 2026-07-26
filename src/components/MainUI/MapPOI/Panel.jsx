/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Panel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-11
 * Last modified: 2026-06-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                from '@Components/MainUI/LGSScrollbars'
import { MapPOIEditListActions }                        from '@Components/MainUI/MapPOI/MapPOIEditListActions'
import { MapPOIList }                                   from '@Components/MainUI/MapPOI/MapPOIList'
import PanelActions                                     from '@Components/PanelsActions'
import WaDrawer                                         from '@Components/WaDrawerNonModal'
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import classNames                                       from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal }                                 from 'react-dom'
import { useSnapshot }                                  from 'valtio'
import { proxyMap }                                     from 'valtio/utils'
import { WaIcon }                                       from '@web.awesome.me/webawesome-pro/dist/react'
import DrawerFooter                                     from '../../DrawerFooter'
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
    const drawerRef = useRef(null)

    // --- HANDLERS ---

    /**
     * Cleans up and closes the POIs editor drawer.
     * Assumes global function __.ui.drawerManager.close() handles the state mutation.
     * @returns {void}
     */
    const closePanel = useCallback((event) => {
                                       if (event.target.tagName === 'WA-DRAWER') {
                                           if (!__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
                                               return
                                           }
                                           __.ui.drawerManager.close()
                                           // Dispatch resize event (keep only if mandatory for scene/layout refresh)
                                           window.dispatchEvent(new Event('resize'))
                                       }
                                   }
        , [])

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

    const isStacked = __.ui.drawerManager.isStacked(POIS_EDITOR_DRAWER)
    const closePanelWithManager = useCallback(() => {
        window.dispatchEvent(new Event('resize'))
        if (__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    useEffect(() => {
        if (drawerOpen) {
            __.ui.drawerManager.restoreDrawerUiState?.(drawerRef.current)
        }
    }, [drawerOpen])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen &&
                <WaDrawer
                    ref={drawerRef}
                    id={POIS_EDITOR_DRAWER}
                    open={true}
                    onWaHide={closePanel}
                    placement={drawerPlacement}
                    className={classNames({'drawer-is-stacked': isStacked})}
                >
                    <PanelActions stackedPanel={isStacked} onBack={isStacked ? closePanelWithManager : null}/>
                    <span slot="label"><WaIcon name="location-dot" variant="regular"/>{'Points of Interest'}</span>

                    <MapPOIEditListActions/>
                    <LGSScrollbars>
                        <MapPOIList/>
                    </LGSScrollbars>
                    <DrawerFooter/>
                </WaDrawer>
            }
        </>
    )
    return drawerRoot ? createPortal(content, drawerRoot) : content

})
