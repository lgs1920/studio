/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-05
 * Last modified: 2025-12-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }         from '@Components/FontAwesomeIcon'
import { MapPOIContent }           from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditContent }       from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }         from '@Components/ToggleStateIcon'
import { POI_STARTER_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faSquare, faSquareCheck } from '@fortawesome/pro-regular-svg-icons' // faMask removed as unused
import { SlDetails }               from '@shoelace-style/shoelace/dist/react'
import { UIToast }                 from '@Utils/UIToast'
import classNames                  from 'classnames'
import { memo, useCallback, useMemo, useRef } from 'react'
import { useSnapshot }             from 'valtio'

// Pre-defined icons - calculate once
const ICONS = {
    true:    faSquareCheck
    , false: faSquare,
}

/**
 * A memoized React component for displaying a single Point of Interest (POI) item in a list.
 * @param {Object} props - Component props
 * @param {string} props.id - The unique ID of the POI
 * @returns {JSX.Element} The rendered POI list item
 */
export const MapPOIListItem = memo(({id}) => {
                                       // --- VALTIO STORE ACCESS ---
                                       const $pois = lgs.stores.main.components.pois
                                       const DEFAULT_POI_BG = lgs.colors.poiDefaultBackground

                                       // Proxy access is '$poiProxy'
                                       const $poiProxy = $pois.list.get(id)
                                       // Snapshot access is 'poi'
                                       const poi = useSnapshot($poiProxy || {})

                                       const globalPoisState = useSnapshot($pois, {sync: true})
                                       const drawerState = useSnapshot(lgs.stores.ui.drawers, {sync: true})

                                       /** @type {React.MutableRefObject<HTMLDivElement | null>} */
                                       const _wrapperElement = useRef(null)

                                       /** @type {React.MutableRefObject<boolean>} */
                                       const _bulkState = useRef(globalPoisState.bulkList.get(id) ?? false)

                                       const current = globalPoisState.current
                                       const bulkList = globalPoisState.bulkList
                                       const drawerOpen = drawerState.open


                                       /**
                                        * Updates the Valtio bulk list and the local ref state.
                                        * @param {boolean} state - The new bulk selection state
                                        * @returns {void}
                                        */
                                       const handleBulkList = useCallback(
                                           (state) => {
                                               // BulkList is a Valtio proxy Map; its mutation is reactive
                                               $pois.bulkList.set(id, state)
                                               _bulkState.current = state
                                           }
                                           , [id, $pois.bulkList],
                                       )

                                       /**
                                        * Copies the POI coordinates to the clipboard and shows a success toast
                                        * @returns {void}
                                        */
                                       const handleCopyCoordinates = useCallback(() => {
                                                                                     __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
                                                                                         UIToast.success({
                                                                                                             caption: poi.title
                                                                                                             , text:  'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                                                                                                         })
                                                                                     })
                                                                                 }
                                           , [poi])

                                       /**
                                        * Handles POI selection, updates global state, and focuses the camera if needed
                                        * @param {Event} event - The DOM event (usually slAfterShow)
                                        * @returns {Promise<void>}
                                        */
                                       const selectPOI = useCallback(async (event) => {
                                                                         if (!window.isOK(event)) {
                                                                             return
                                                                         }

                                                                         const needsNewSelection = current === false || current !== id

                                                                         if (needsNewSelection) {
                                                                             $pois.current = id // Mutate global state
                                                                                                // (proxy)
                                                                             if ($poiProxy) {
                                                                                 $poiProxy.animated = false
                                                                             }
                                                                             const filteredStore = drawerOpen === POIS_EDITOR_DRAWER
                                                                                                   ? $pois.filtered.global
                                                                                                   : $pois.filtered.journey

                                                                             const filteredPOI = filteredStore.get(id)

                                                                             // Handle focus and animation logic
                                                                             if (lgs.settings.ui.poi.focusOnEdit && drawerOpen === POIS_EDITOR_DRAWER && __.ui.drawerManager.over) {
                                                                                 const camera = lgs.mainProxy.components.camera

                                                                                 if (__.ui.cameraManager.isRotating()) {
                                                                                     await __.ui.cameraManager.stopRotate()
                                                                                     filteredPOI?.stopAnimation?.()
                                                                                 }

                                                                                 __.ui.sceneManager.focus(filteredPOI, {
                                                                                     target:       filteredPOI
                                                                                     , heading:    camera.position.heading
                                                                                     , pitch:      camera.position.pitch
                                                                                     , roll:       camera.position.roll
                                                                                     , range:      5000
                                                                                     , infinite:   false
                                                                                     , rpm:        lgs.settings.ui.poi.rpm
                                                                                     , rotations:  1
                                                                                     , rotate:     lgs.settings.ui.poi.rotate
                                                                                     , panoramic:  false
                                                                                     , flyingTime: 0,
                                                                                 })

                                                                                 if (lgs.settings.ui.poi.rotate) {
                                                                                     filteredPOI?.startAnimation?.()
                                                                                 }
                                                                             }
                                                                         }

                                                                         // Scroll to item
                                                                         const item = document.getElementById(`edit-map-poi-${id}`)
                                                                         if (item) {
                                                                             item.scrollIntoView({behavior: 'smooth', block: 'start'})
                                                                             item.focus()
                                                                         }
                                                                     }
                                           , [id, current, drawerOpen, $pois, $poiProxy])

                                       /**
                                        * Handles the SlDetails *after* closing event.
                                        * Uses preventDefault and stopPropagation to prevent the parent SlDrawer from
                                        * closing.
                                        * @param {Event} event - The Shoelace event
                                        * @returns {void}
                                        */
                                       const handleSlAfterHide = useCallback((event) => {
                                                                                 event.stopPropagation()
                                                                                 event.preventDefault()
                                                                             }
                                           , [])


                                       /**
                                        * Calculates the inline styles for the POI item based on its colors
                                        * @returns {React.CSSProperties}
                                        */
                                       const styles = useMemo(() => {
                                                                  if (!poi.id) {
                                                                      return {}
                                                                  }

                                                                  const bgColor = poi.bgColor ?? DEFAULT_POI_BG
                                                                  return {
                                                                      '--map-poi-bg-header':      __.ui.ui.hexToRGBA(bgColor, 'rgba', 0.2)
                                                                      , '--fa-primary-color':     poi.color
                                                                      , '--fa-secondary-color':   bgColor
                                                                      , '--fa-primary-opacity':   1
                                                                      , '--fa-secondary-opacity': 1,
                                                                  }
                                                              }
                                           , [poi.bgColor, poi.color])

                                       /**
                                        * Calculates the CSS classes for the POI item
                                        * @returns {string}
                                        */
                                       const classes = useMemo(() => {
                                                                   if (!poi.id) {
                                                                       return 'edit-map-poi-item'
                                                                   }

                                                                   return classNames('edit-map-poi-item', {
                                                                       'map-poi-starter': poi.type === POI_STARTER_TYPE,
                                                                   })
                                                               }
                                           , [poi.type])

                                       /**
                                        * Gets the current bulk state from the global list
                                        * @returns {boolean}
                                        */
                                       const bulkState = useMemo(() => bulkList.get(id) ?? false
                                           , [bulkList, id])

                                       // --- RENDER ---

                                       // Early return if POI doesn't exist
                                       if (!poi.id) {
                                           return null
                                       }

                                       return (
                                           <div className="edit-map-poi-item-wrapper" ref={_wrapperElement}>
                                               <ToggleStateIcon
                                                   initial={bulkState}
                                                   className="map-poi-bulk-indicator"
                                                   icons={ICONS}
                                                   onChange={handleBulkList}
                                                   id={`bulk-map-poi-${id}`}
                                               />
                                               <SlDetails
                                                   className={classes}
                                                   id={`edit-map-poi-${id}`}
                                                   onSlAfterShow={selectPOI}
                                                   onSlAfterHide={handleSlAfterHide}
                                                   open={current === id}
                                                   small
                                                   style={styles}
                                               >
                                                   {/* Prevent click bubbling here if needed, but onSlAfterHide should handle the drawer closing */}
                                                   <div slot="summary">
                                                       <div>
                                                           <MapPOIContent poi={poi.id} useInMenu={true}/>
                                                           <span>{poi.title}</span>
                                                       </div>
                                                   </div>
                                                   {current === id && <MapPOIEditContent poi={poi}/>}
                                               </SlDetails>
                                           </div>
                                       )
                                   }
    , (prevProps, nextProps) => {
        // Optimization: only re-render if the ID or the context changes
        return prevProps.id === nextProps.id && prevProps.context === nextProps.context
    })

MapPOIListItem.displayName = 'MapPOIListItem'