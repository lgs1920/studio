/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIBulkActionsMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-08
 * Last modified: 2025-12-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import {
    faArrowsFromLine, faArrowsToLine, faLocationDot, faTrashCan,
}                                                                         from '@fortawesome/pro-regular-svg-icons'
import { faEye, faMask }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDropdown, SlIcon, SlIconButton, SlMenu, SlMenuItem } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                          from '@Utils/FA2SL'
import React, { useEffect, useState, useCallback }                        from 'react'
import { useSnapshot }                                                    from 'valtio'
import './style.css'

/**
 * Represents the context menu for interacting with Points of Interest (POI) on the map.
 *
 * This component provides a menu for bulk actions on selected POIs,
 * including visibility, size change, and removal.
 *
 * @param {object} globals - The global context object.
 * @returns {JSX.Element} The bulk actions menu component.
 */
export const MapPOIBulkActionsMenu = React.memo((globals) => {

    // Access global proxies and snapshots
    const $pois = lgs.mainProxy.components.pois
    const pois = useSnapshot($pois)
    const drawers = useSnapshot(lgs.stores.ui.drawers)

    // Component state
    const [disabled, setDisabled] = useState(false)

    // Determine if the component is restricted to the journey editor context
    const onlyJourney = drawers.open === JOURNEY_EDITOR_DRAWER

    /**
     * Hides all Points of Interest currently selected for bulk action.
     */
    const hide = useCallback(() => {
        $pois.bulkList.forEach((canHide, id) => {
            if (canHide) {
                // Accessing the proxy directly to ensure reactive state mutation
                const $poi = $pois.list.get(id)
                $poi.hide()
            }
        })
        $pois.bulkList.clear()
    }, [])

    /**
     * Shows all Points of Interest currently selected for bulk action.
     */
    const show = useCallback(() => {
        $pois.bulkList.forEach((canShow, id) => {
            if (canShow) {
                // Accessing the proxy directly to ensure reactive state mutation
                const $poi = $pois.list.get(id)
                $poi.show()
            }
        })
        $pois.bulkList.clear()
    }, [])

    /**
     * Reduces the size of all Points of Interest currently selected for bulk action.
     */
    const shrink = useCallback(() => {
        $pois.bulkList.forEach(async (canReduce, id) => {
            if (canReduce) {
                // TODO : poi.shrink does not work
                await __.ui.poiManager.updatePOI(id, {expanded: false})
            }
        })
        $pois.bulkList.clear()
    }, [])

    /**
     * Expands the size of all Points of Interest currently selected for bulk action.
     */
    const expand = useCallback(() => {
        $pois.bulkList.forEach(async (canExpand, id) => {
            if (canExpand) {
                // TODO : poi.expand does not work
                await __.ui.poiManager.updatePOI(id, {expanded: true})
            }
        })
        $pois.bulkList.clear()
    }, [])

    /**
     * Removes the selected Points of Interest and associated UI elements.
     *
     * Postcondition:
     * - Camera rotation is stopped if it was active.
     */
    const remove = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        // Check if current POI is in the bulk list
        const needToChangeCurrent = $pois.bulkList.has(pois.current)
        const actions = []

        $pois.bulkList.forEach((canRemove, id) => {
            if (canRemove) {
                actions.push(__.ui.poiManager.remove({id: id}))
            }
        })

        // Wait for all removal actions to complete
        await Promise.all(actions).then(results => {
            results.forEach(result => {
                if (result.success) {
                    // Update the filtered list based on the current context (Journey or Global)
                    if (onlyJourney) {
                        $pois.filtered.journey.delete(result.id)
                    }
                    else {
                        $pois.filtered.global.delete(result.id)
                    }
                }
            })
        })

        // Change current POI if the previous one was removed
        if (needToChangeCurrent) {
            let nextCurrent = false

            if (onlyJourney) {
                // Select the first remaining POI in the journey filter map
                const firstEntry = $pois.filtered.journey.entries().next()
                nextCurrent = firstEntry.done ? false : firstEntry.value[0]
            }
            else {
                // Select the first remaining POI in the global filter map
                const firstEntry = $pois.filtered.global.entries().next()
                nextCurrent = firstEntry.done ? false : firstEntry.value[0]
            }

            $pois.current = nextCurrent
        }

        // Clear the bulk selection list
        $pois.bulkList.clear()
    }, [onlyJourney, pois.current])

    /**
     * Updates the disabled state based on whether the bulk list contains any selected POI.
     * The effect runs whenever the bulkList map changes.
     */
    useEffect(() => {
        // Check if all values in the bulkList map are 'false'
        setDisabled(Array.from(pois.bulkList.values()).every((value) => value === false))
    }, [pois.bulkList])

    const handleAfterHide = (event) => {
        event.preventDefault()
        event.stopPropagation()
    }

    return (
        <SlDropdown disabled={disabled} onSlAfterHide={handleAfterHide}>
            <SlButton slot="trigger" size="small" caret disabled={disabled}>
                <SlIconButton size="small" slot="prefix"
                              library="fa"
                              name={FA2SL.set(faLocationDot)}
                />{'Select an action'}
            </SlButton>

            <SlMenu small>
                <SlMenuItem onClick={remove}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}></SlIcon>
                    <span>Remove</span>
                </SlMenuItem>

                <SlMenuItem onClick={shrink}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsToLine)}></SlIcon>
                    <span>Reduce</span>
                </SlMenuItem>

                <SlMenuItem onClick={expand}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                    <span>Expand</span>
                </SlMenuItem>

                <SlMenuItem onClick={hide}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                    <span>Hide</span>
                </SlMenuItem>

                <SlMenuItem onClick={show}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEye)}></SlIcon>
                    <span>Show</span>
                </SlMenuItem>

            </SlMenu>
        </SlDropdown>
    )
})