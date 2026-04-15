/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditFilterPopup.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-15
 * Last modified: 2026-04-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOICategorySelectorFilter }          from '@Components/MainUI/MapPOI/MapPOICategorySelectorFilter'
import { ToggleStateIcon }                       from '@Components/ToggleStateIcon'
import { JOURNEY_EDITOR_DRAWER }                 from '@Core/constants'
import {
    WaButton, WaCallout, WaCard, WaIcon, WaInput, WaSwitch, WaTooltip,
}                                                from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                           from 'valtio'

/**
 * Renders a filter UI for Points of Interest (POIs) on a map.
 */
export const MapPOIEditFilterPopup = memo(() => {
    const $poi = lgs.settings.poi
    const poi = useSnapshot($poi, {sync: true})
    const store = lgs.stores.main.components.pois
    const pois = useSnapshot(store)
    const drawers = useSnapshot(lgs.stores.ui.drawers)

    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const enoughPOIs = useCallback(() => {
        return Array.from(pois.list.values()).some(obj => obj.type !== undefined)
    }, [pois.list])

    const applyFilter = useCallback(() => {
        if (!enoughPOIs()) {
            $poi.filter.active = false
            $poi.filter.count = 0
            return
        }

        const {byName, byCategories, global, journey, exclude} = lgs.settings.poi.filter
        const search = byName.toLowerCase().trim()
        const allPois = Array.from(pois.list.values())

        const filtered = allPois.filter(item => {
            // 1. Name Filter
            const matchesName = search === '' || (item.title && item.title.trim().toLowerCase().includes(search))

            if (!matchesName) {
                return false
            }

            // 2. Category Filter (Inclusion/Exclusion)
            let matchesCategory = true
            if (byCategories.length > 0) {
                const isInCategory = byCategories.includes(item.type)
                matchesCategory = exclude ? !isInCategory : isInCategory
                if (!matchesCategory) {
                    return false
                }
            }

            // 3. Type Filter (Global vs Journey)
            const isGlobalItem = item.parent === null || item.parent === undefined
            if (onlyJourney) {
                return !isGlobalItem
            }

            return (isGlobalItem && global) || (!isGlobalItem && journey)
        })

        $poi.filter.count = filtered.length
        $poi.filter.active = search !== '' || byCategories.length > 0 || exclude || !poi.filter.alphabetic

    }, [enoughPOIs, onlyJourney, pois.list, poi.filter.alphabetic])

    const resetFilter = useCallback(() => {
        $poi.filter.byName = ''
        $poi.filter.alphabetic = true
        $poi.filter.byCategories = []
        $poi.filter.exclude = false
        $poi.filter.global = !onlyJourney
        $poi.filter.journey = onlyJourney
        $poi.filter.active = false
    }, [onlyJourney])

    const handleFilterByName = useCallback(event => {
        $poi.filter.byName = event.target.value
    }, [])

    const handleAlphabetic = useCallback(() => {
        $poi.filter.alphabetic = !lgs.settings.poi.filter.alphabetic
    }, [])

    const handleCategories = useCallback(event => {
        if (event.target.nodeName !== 'WA-SWITCH') {
            $poi.filter.byCategories = event.target.value ?? []
        }
    }, [])

    const handleExclusion = useCallback((event) => {
        $poi.filter.exclude = event.target.checked
    }, [])

    const handleGlobal = useCallback(() => {
        const newGlobal = !lgs.settings.poi.filter.global
        $poi.filter.global = newGlobal
        if (!newGlobal && !lgs.settings.poi.filter.journey) {
            $poi.filter.journey = true
        }
    }, [])

    const handleJourney = useCallback(() => {
        const newJourney = !lgs.settings.poi.filter.journey
        $poi.filter.journey = newJourney
        if (!newJourney && !lgs.settings.poi.filter.global) {
            $poi.filter.global = true
        }
    }, [])

    const handleClose = useCallback((event) => {
        $poi.filter.open = false
        if (event) {
            event.preventDefault()
        }
    }, [])

    useEffect(() => {
        applyFilter()
    }, [poi.filter.byName, poi.filter.byCategories, poi.filter.global, poi.filter.journey, poi.filter.exclude, pois.list.size, applyFilter])

    if (!poi.filter.open) {
        return null
    }

    return (
        <WaCard className="lgs--popup-in-drawer lgs-slide-down">
            <WaButton appearance="plain" slot="header-actions" onClick={handleClose}>
                <WaIcon size="small" name="xmark" variant="regular"/>
            </WaButton>

            <h3 slot="header">
                <WaIcon name="filter" variant="regular"/> {'Filter POIs'}
            </h3>

            <div className="map-poi-filter-by-name">
                <WaInput
                    label="By Name"
                    type="text"
                    size="small"
                    withClear
                    value={poi.filter.byName}
                    onInput={handleFilterByName}
                    className="edit-map-poi-input"
                />
                <WaTooltip for="map-poi-filter-alphabetic">
                    {poi.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}
                </WaTooltip>
                <ToggleStateIcon
                    id="map-poi-filter-alphabetic"
                    icons={{shown: 'arrow-down-a-z', hidden: 'arrow-down-z-a'}}
                    initial={poi.filter.alphabetic}
                    onChange={handleAlphabetic}
                />
            </div>

            <MapPOICategorySelectorFilter
                exclude={poi.filter.exclude}
                handleExclusion={handleExclusion}
                handleCategories={handleCategories}
                onChange={applyFilter}
            />

            <div className="map-poi-filter-by-type">
                {!onlyJourney && (
                    <>
                        <WaSwitch size="xsmall" label-at-start checked={poi.filter.global} onChange={handleGlobal}>
                            {'Display Global POIs'}
                        </WaSwitch>
                        {lgs.theJourney && (
                            <WaSwitch size="xsmall" label-at-start checked={poi.filter.journey}
                                      onChange={handleJourney}>
                                {'Display Journey POIs'}
                            </WaSwitch>
                        )}
                    </>
                )}
            </div>

            <WaCallout
                size="small"
                variant={poi.filter.count === 0 ? 'danger' : 'neutral'}
                className="map-poi-filter-count-info"
            >
                <WaIcon slot="icon" size="small" name={poi.filter.count === 0 ? 'warning' : 'list'}/>
                <div>
                    <span>
                        {poi.filter.count === 0 ? 'No POIs match the current filter criteria.' : `Showing ${poi.filter.count} POIs`}
                    </span>
                    {poi.filter.count === 0 && (
                        <WaButton id="lgs--reset-pois-filters-callout" size="x-small" onClick={resetFilter}
                                  appearance="outlined" variant="danger" disabled={!poi.filter.active}>
                            <WaIcon slot="start" size="small" name="filter-circle-xmark"/> {'Reset'}
                        </WaButton>
                    )}
                </div>
            </WaCallout>

            <div slot="footer">
                <div className="lgs--popup-in-drawer-footer">
                    <WaTooltip for="lgs--reset-pois-filters">{'Reset Filters'}</WaTooltip>
                    <WaButton
                        id="lgs--reset-pois-filters"
                        size="small"
                        onClick={resetFilter}
                        appearance="outlined"
                        variant="brand"
                        disabled={!poi.filter.active}
                    >
                        <WaIcon slot="start" size="small" name="filter-circle-xmark"/> {'Reset'}
                    </WaButton>

                    <WaTooltip for="lgs--close-pois-filters">{'Close settings'}</WaTooltip>
                    <WaButton
                        id="lgs--close-pois-filters"
                        size="small"
                        variant="brand"
                        onClick={handleClose}
                    >
                        <WaIcon slot="start" size="small" name="xmark" variant="regular"/> {'Close'}
                    </WaButton>
                </div>
            </div>
        </WaCard>
    )
})