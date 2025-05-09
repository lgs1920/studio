/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIMonitor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-09
 * Last modified: 2025-05-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useSnapshot }       from 'valtio'
import { useEffect, useRef } from 'react'
import { updatedDiff }       from 'deep-object-diff'

/**
 * Checks if an object is empty by verifying it has no own properties
 * @param {Object} obj - Object to check
 * @returns {boolean} True if the object has no own properties, false otherwise
 */
const isEmpty = obj => Object.keys(obj).length === 0

/**
 * React component that watches a Valtio proxy Map for MapPOI additions, removals,
 * or attribute changes, triggering draw, remove, or redraw actions
 * @returns {null} Returns null as the component has no UI
 */
export const MapPOIMonitor = () => {
    // Get reactive snapshot of the POI list from Valtio store
    const currentList = useSnapshot(lgs.stores.main.components.pois).list
    // Store previous POI list state for comparison
    const _previousList = useRef(new Map())

    /**
     * Adds event listeners for a MapPOI
     * @param {MapPOI} poi - MapPOI instance to add listeners for
     */
    const addPOIEventListeners = poi => {
        // Register double-click event to toggle POI expansion
        __.canvasEvents.onDoubleClick(poi.toggleExpand, {entity: poi.id})
    }

    /**
     * Removes event listeners for a MapPOI
     * @param {MapPOI} poi - MapPOI instance to remove listeners for
     */
    const removePOIEventListeners = poi => {
        __.canvasEvents.offDoubleClick(poi.toggleExpand)
    }

    // Effect to detect changes in the POI list
    useEffect(() => {
        // Reference previous list for comparison
        const previousList = _previousList.current

        // Detect added POIs
        for (const [id, poi] of currentList) {
            if (!previousList.has(id)) {
                // Add event listeners and draw new POI
                addPOIEventListeners(poi)
                poi.draw()
            }
        }

        // Detect removed POIs
        for (const [id, poi] of previousList) {
            if (!currentList.has(id)) {
                // Remove event listeners and remove POI
                removePOIEventListeners(poi)
                poi.remove()
            }
        }

        // Detect changed POIs
        for (const [id, poi] of currentList) {
            const previous = previousList.get(id)
            if (previous) {
                // Compare attributes, excluding methods
                const changedFields = updatedDiff(__.app.filterAttributes(previous), __.app.filterAttributes(poi))
                if (!isEmpty(changedFields)) {
                    // Log changes for debugging and redraw POI
                    poi.draw()
                }
            }
        }

        // Update previous list state
        _previousList.current = new Map(currentList)
    }, [currentList])

    return null
}