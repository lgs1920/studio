/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-23
 * Last modified: 2025-06-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOICategorySelectorFilter }                      from '@Components/MainUI/MapPOI/MapPOICategorySelectorFilter'
import { ToggleStateIcon }                                   from '@Components/ToggleStateIcon'
import { JOURNEY_EDITOR_DRAWER }                             from '@Core/constants'
import { faArrowDownAZ, faArrowDownZA, faFilterCircleXmark } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIconButton, SlInput, SlSwitch, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                             from '@Utils/FA2SL'
import React, { useCallback, useEffect, useMemo }            from 'react'
import { useSnapshot }                                       from 'valtio/index'

/**
 * MapPOIEditFilter component for filtering Points of Interest (POIs) on a map.
 * Provides controls for filtering by name, category, alphabetic order, and global/journey settings.
 * Uses Valtio for state management and memoization to optimize performance.
 * @returns {JSX.Element} The rendered filter UI component
 */
export const MapPOIEditFilter = () => {
  // Stabilize Valtio proxies with useSnapshot for consistent references
  const settings = useSnapshot(lgs.settings.poi, {sync: true})
  const store = lgs.mainProxy.components.pois
  const pois = useSnapshot(store)
  const drawers = useSnapshot(lgs.mainProxy.drawers)
  // Determine if only journey-specific POIs should be shown
  const onlyJourney = drawers.open === JOURNEY_EDITOR_DRAWER

  /**
   * Checks if there are enough valid POIs (with defined type) to enable filtering
   * @returns {boolean} True if at least one valid POI exists
   */
  const enoughPOIs = useCallback(() => {
    // Use `some` for early exit to improve performance
    return Array.from(pois.list.values()).some(obj => obj.type !== undefined)
  }, [pois.list])

  /**
   * Applies filtering logic based on current settings and updates filter state
   */
  const applyFilter = useCallback(() => {
    // Disable filtering if no valid POIs exist
    if (!enoughPOIs()) {
      lgs.settings.poi.filter.active = false
      lgs.settings.poi.filter.open = false
      return
    }
    const {byName, alphabetic, byCategories, global, journey} = lgs.settings.poi.filter
    // Activate filter if any non-default settings are applied
    lgs.settings.poi.filter.active =
        byName !== '' ||
        !alphabetic ||
        byCategories.length > 0 ||
        (!onlyJourney && (!global || journey))
  }, [enoughPOIs, onlyJourney])

  /**
   * Resets all filter settings to their default values
   */
  const resetFilter = useCallback(() => {
    lgs.settings.poi.filter.byName = ''
    lgs.settings.poi.filter.alphabetic = true
    lgs.settings.poi.filter.byCategories = []
    if (!onlyJourney) {
      lgs.settings.poi.filter.global = true
      lgs.settings.poi.filter.journey = false
    }
  }, [onlyJourney])

  /**
   * Toggles the filter UI visibility
   */
  const handleFilter = useCallback(() => {
    lgs.settings.poi.filter.open = !lgs.settings.poi.filter.open
  }, [])

  /**
   * Updates the filter by name based on input value
   * @param {Object} event - The input event
   */
  const handleFilterByName = useCallback((event) => {
    lgs.settings.poi.filter.byName = event.target.value
  }, [])

  /**
   * Toggles alphabetic sorting order
   */
  const handleAlphabetic = useCallback(() => {
    lgs.settings.poi.filter.alphabetic = !lgs.settings.poi.filter.alphabetic
  }, [])

  /**
   * Updates category filter based on selected categories
   * @param {Object} event - The category selection event
   */
  const handleCategories = useCallback((event) => {
    if (event.target.nodeName !== 'SL-SWITCH') {
      lgs.settings.poi.filter.byCategories = event.target.value ?? []
    }
  }, [])

  /**
   * Toggles category exclusion mode
   */
  const handleExclusion = useCallback(() => {
    lgs.settings.poi.filter.exclude = !lgs.settings.poi.filter.exclude
  }, [])

  /**
   * Toggles display of global POIs, ensuring at least one display option is active
   */
  const handleGlobal = useCallback(() => {
    lgs.settings.poi.filter.global = !lgs.settings.poi.filter.global
    if (!lgs.settings.poi.filter.global && !lgs.settings.poi.filter.journey) {
      lgs.settings.poi.filter.global = true
    }
  }, [])

  /**
   * Toggles display of journey-specific POIs, ensuring at least one display option is active
   */
  const handleJourney = useCallback(() => {
    lgs.settings.poi.filter.journey = !lgs.settings.poi.filter.journey
    if (!lgs.settings.poi.filter.global && !lgs.settings.poi.filter.journey) {
      lgs.settings.poi.filter.global = true
    }
  }, [])

  // Memoize filter dependencies to prevent unnecessary useEffect triggers
  const filterDeps = useMemo(() => ({
    byName:       settings.filter.byName,
    alphabetic:   settings.filter.alphabetic,
    byCategories: settings.filter.byCategories,
    global:       settings.filter.global,
    journey:      settings.filter.journey,
    active:       settings.filter.active,
    open:         settings.filter.open,
    exclude:      settings.filter.exclude,
  }), [settings.filter])

  // Apply filter whenever relevant settings or POI list size change
  useEffect(() => {
    applyFilter()
  }, [filterDeps, pois.list.size, applyFilter])

  return (
      <>
        {settings.filter.open && (
            <div className="map-poi-edit-filter lgs-card">
              {/* Filter by name and alphabetic sort controls */}
              <div className="map-poi-filter-by-name">
                <SlInput
                    label="By Name"
                    type="text"
                    size="small"
                    value={settings.filter.byName}
                    onSlChange={handleFilterByName}
                    onInput={handleFilterByName}
                    className="edit-map-poi-input"
                />
                <SlTooltip hoist content={settings.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}>
                  <ToggleStateIcon
                      id="map-poi-filter-alphabetic"
                      icons={{shown: faArrowDownAZ, hidden: faArrowDownZA}}
                      initial={settings.filter.alphabetic}
                      onChange={handleAlphabetic}
                  />
                </SlTooltip>
                {settings.filter.active && (
                    <SlButton size="small" className="map-poi-clear-filter" onClick={resetFilter}>
                      <SlIconButton size="small" library="fa" name={FA2SL.set(faFilterCircleXmark)}/>
                      {'Reset Filters'}
                    </SlButton>
                )}
              </div>
              {/* Category filter controls */}
              <MapPOICategorySelectorFilter
                  handleExclusion={handleExclusion}
                  handleCategories={handleCategories}
                  onChange={applyFilter}
              />
              {/* Global and journey POI display toggles */}
              <div className="map-poi-filter-by-type">
                {!onlyJourney && (
                    <>
                      <SlSwitch
                          size="small"
                          align-right
                          checked={settings.filter.global}
                          onSlChange={handleGlobal}
                      >
                        {'Display Global POIs'}
                      </SlSwitch>
                      {lgs.theJourney && (
                          <SlSwitch
                              size="small"
                              align-right
                              checked={settings.filter.journey}
                              onSlChange={handleJourney}
                          >
                            {'Display Journey POIs'}
                          </SlSwitch>
                      )}
                    </>
                )}
              </div>
            </div>
        )}
      </>
  )
}