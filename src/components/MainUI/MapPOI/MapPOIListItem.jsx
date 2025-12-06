/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-06
 * Last modified: 2025-12-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIContent }           from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditContent }       from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }         from '@Components/ToggleStateIcon'
import { POI_STARTER_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faSquare, faSquareCheck }                       from '@fortawesome/pro-regular-svg-icons'
import { SlDetails }               from '@shoelace-style/shoelace/dist/react'
import { UIToast }                 from '@Utils/UIToast'
import classNames                                        from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                   from 'valtio'
import { subscribe }                                     from 'valtio'

const ICONS = {true: faSquareCheck, false: faSquare}

/**
 * Renders a single POI entry in the map POI list.
 * Highly optimised to prevent unnecessary re-renders while keeping reactivity.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id      POI unique identifier
 * @param {string} [props.context] Optional context passed from parent (kept for future use)
 */
export const MapPOIListItem = memo(({id, context}) => {
                                       const $pois = lgs.stores.main.components.pois
                                       const DEFAULT_POI_BG = lgs.colors.poiDefaultBackground

                                       // Direct proxy to the POI object (reactive mutations)
                                       const $poiProxy = $pois.list.get(id)
                                       // Snapshot of the POI for rendering (immutable)
                                       const poi = useSnapshot($poiProxy || {})

                                       // Minimal reactive snapshots – only what we really need
                                       const {current, bulkList} = useSnapshot($pois, {sync: true})
                                       const {open: drawerOpen} = useSnapshot(lgs.stores.ui.drawers, {sync: true})

                                       /** Current bulk selection state for this POI */
                                       const isBulkSelected = bulkList.get(id) ?? false

                                       /** True when this POI is the currently selected one */
                                       const isCurrent = current === id

                                       /** True when the global POIs editor drawer is open */
                                       const isGlobalDrawer = drawerOpen === POIS_EDITOR_DRAWER

                                       /** Toggle bulk selection for this POI */
                                       const toggleBulk = useCallback(
                                           state => $pois.bulkList.set(id, state),
                                           [id],
                                       )

                                       /** Copy POI coordinates to clipboard */
                                       const copyCoordinates = useCallback(() => {
                                           __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() =>
                                                                                                     UIToast.success({
                                                                                                                         caption: poi.title,
                                                                                                                         text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                                                                                                                     }),
                                           )
                                       }, [])

                                       /** Select this POI – focus camera, scroll into view, update global current */
                                       const selectPOI = useCallback(async () => {
                                           if (current === id) {
                                               return
                                           }

                                           $pois.current = id
                                           if ($poiProxy) {
                                               $poiProxy.animated = false
                                           }

                                           const filteredStore = isGlobalDrawer ? $pois.filtered.global : $pois.filtered.journey
                                           const filteredPOI = filteredStore.get(id)

                                           // Camera focus + optional rotation when editing
                                           if (lgs.settings.ui.poi.focusOnEdit && isGlobalDrawer && __.ui.drawerManager.over) {
                                               const camera = lgs.mainProxy.components.camera

                                               if (__.ui.cameraManager.isRotating()) {
                                                   await __.ui.cameraManager.stopRotate()
                                                   filteredPOI?.stopAnimation?.()
                                               }

                                               __.ui.sceneManager.focus(filteredPOI, {
                                                   target:     filteredPOI,
                                                   heading:    camera.position.heading,
                                                   pitch:      camera.position.pitch,
                                                   roll:       camera.position.roll,
                                                   range:      5000,
                                                   infinite:   false,
                                                   rpm:        lgs.settings.ui.poi.rpm,
                                                   rotations:  1,
                                                   rotate:     lgs.settings.ui.poi.rotate,
                                                   panoramic:  false,
                                                   flyingTime: 0,
                                               })

                                               if (lgs.settings.ui.poi.rotate) {
                                                   filteredPOI?.startAnimation?.()
                                               }
                                           }

                                           // Smooth scroll to item
                                           const element = document.getElementById(`edit-map-poi-${id}`)
                                           element?.scrollIntoView({behavior: 'smooth', block: 'start'})
                                           element?.focus()
                                       }, [id, current, isGlobalDrawer, $poiProxy])

                                       /** Prevent SlDetails hide event from bubbling and closing parent drawer */
                                       const preventDrawerClose = useCallback(event => {
                                           event.stopPropagation()
                                           event.preventDefault()
                                       }, [])

                                       /** Inline CSS variables based on POI colors */
                                       const styles = useMemo(() => {
                                           if (!poi.id) {
                                               return {}
                                           }
                                           const bg = poi.bgColor ?? DEFAULT_POI_BG
                                           return {
                                               '--map-poi-bg-header':    __.ui.ui.hexToRGBA(bg, 'rgba', 0.2),
                                               '--fa-primary-color':     poi.color,
                                               '--fa-secondary-color':   bg,
                                               '--fa-primary-opacity':   1,
                                               '--fa-secondary-opacity': 1,
                                           }
                                       }, [poi.id, poi.bgColor, poi.color])

                                       /** Dynamic class names */
                                       const classes = useMemo(
                                           () => classNames('edit-map-poi-item', {
                                               'map-poi-starter': poi.type === POI_STARTER_TYPE,
                                           }),
                                           [poi.type],
                                       )

                                       // Early exit if POI no longer exists
                                       if (!poi.id) {
                                           return null
                                       }

                                       return (
                                           <div className="edit-map-poi-item-wrapper">
                                               <ToggleStateIcon
                                                   initial={isBulkSelected}
                                                   className="map-poi-bulk-indicator"
                                                   icons={ICONS}
                                                   onChange={toggleBulk}
                                                   id={`bulk-map-poi-${id}`}
                                               />

                                               <SlDetails
                                                   className={classes}
                                                   id={`edit-map-poi-${id}`}
                                                   style={styles}
                                                   open={isCurrent}
                                                   small
                                                   onSlAfterShow={selectPOI}
                                                   onSlAfterHide={preventDrawerClose}
                                               >
                                                   <div slot="summary">
                                                       <div>
                                                           <MapPOIContent poi={id} useInMenu={true}/>
                                                           <span>{poi.title}</span>
                                                       </div>
                                                   </div>
                                                   {current === id && <MapPOIEditContent poi={id}/>}
                                               </SlDetails>
                                           </div>
                                       )
                                   },
                                   // Custom comparison – re-render only when the POI id changes (context is stable)
                                   (prev, next) => prev.id === next.id)

MapPOIListItem.displayName = 'MapPOIListItem'