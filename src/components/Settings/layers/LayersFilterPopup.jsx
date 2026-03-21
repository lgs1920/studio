/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayersFilterPopup.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-21
 * Last modified: 2026-03-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    ALL, LOCKED, UNLOCKED,
    BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY,
}                                 from '@Core/constants'
import {
    WaButton, WaCallout, WaIcon, WaInput, WaOption, WaRadio, WaRadioGroup, WaSelect, WaTooltip,
}                                 from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect } from 'react'
import { useSnapshot }            from 'valtio'

/**
 * FilterEntities component for managing layer filtering criteria.
 * Uses system constants for entity types (Base, Overlay, Terrain).
 * @returns {JSX.Element} The rendered filter popup
 */
export const LayersFilterPopup = () => {
    const $editor = lgs.editorSettingsProxy
    const editor = useSnapshot($editor)

    const $layers = lgs.settings.layers
    const layers = useSnapshot($layers)

    /**
     * Re-evaluates filter state and updates type-specific counts using Core constants.
     */
    const applyFilter = useCallback(() => {
        const {byUsage, byName, byCountries} = $layers.filter
        const searchStr = (byName || '').toLowerCase().trim()

        // Update global active state
        const isActive = byUsage !== ALL ||
            searchStr !== '' ||
            (byCountries && byCountries.length > 0)

        $layers.filter.active = isActive

        // Source data retrieval
        const allLayers = Array.from(__.layersAndTerrainManager.layers.values())

        // Initialize counters based on entity types
        const counts = {
            total:   0,
            base:    0,
            overlay: 0,
            terrain: 0,
        }

        allLayers.forEach(layer => {
            // 1. Name match logic
            const itemName = (layer.name || '').toLowerCase()
            const matchesName = searchStr === '' || itemName.includes(searchStr)
            if (!matchesName) {
                return
            }

            // 2. Usage match logic (Locked/Unlocked)
            if (byUsage !== ALL) {
                const isLocked = layer.locked === true
                if (byUsage === LOCKED && !isLocked) {
                    return
                }
                if (byUsage === UNLOCKED && isLocked) {
                    return
                }
            }

            // 3. Country match logic
            if (byCountries && byCountries.length > 0) {
                if (!layer.countryCode || !byCountries.includes(layer.countryCode)) {
                    return
                }
            }

            // All criteria met
            counts.total++

            // Increment type counters using BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY
            if (layer.type === BASE_ENTITY) {
                counts.base++
            }
            else if (layer.type === OVERLAY_ENTITY) {
                counts.overlay++
            }
            else if (layer.type === TERRAIN_ENTITY) {
                counts.terrain++
            }
        })

        // Sync detailed results to proxy
        $layers.filter.count = counts.total
        $layers.filter.countBase = counts.base
        $layers.filter.countOverlay = counts.overlay
        $layers.filter.countTerrain = counts.terrain
    }, [])

    const handleUsage = (event) => {
        $layers.filter.byUsage = event.target.value
    }

    const handleName = (event) => {
        $layers.filter.byName = event.target.value
    }

    const handleCountries = (event) => {
        $layers.filter.byCountries = event.target.value
    }

    /**
     * Resets all filter values to default state.
     */
    const disableFilter = () => {
        $layers.filter.byUsage = ALL
        $layers.filter.byName = ''
        $layers.filter.byCountries = []
        $layers.filter.active = false
    }

    const close = () => {
        $editor.openFilter = false
    }

    // Recalculate whenever filter parameters change
    useEffect(() => {
        applyFilter()
    }, [layers.filter.byUsage, layers.filter.byName, layers.filter.byCountries, applyFilter])

    /**
     * Builds the breakdown string, excluding types with zero results.
     * @returns {string} Formatted breakdown or empty string
     */
    const getBreakdown = () => {
        const parts = []
        if (layers.filter.countBase > 0) {
            parts.push(`${layers.filter.countBase} Base`)
        }
        if (layers.filter.countOverlay > 0) {
            parts.push(`${layers.filter.countOverlay} Overlay`)
        }
        if (layers.filter.countTerrain > 0) {
            parts.push(`${layers.filter.countTerrain} Terrain`)
        }

        return parts.length > 0 ? ` (${parts.join(' / ')})` : ''
    }

    return (
        <>
            {editor.openFilter &&
                <wa-card id="filter-entities" key="filter-entities"
                         className="lgs-slide-down lgs--popup-in-drawer fix-margin">

                    <WaButton appearance="plain"
                              slot="header-actions"
                              onClick={close}>
                        <WaIcon size="small" name="xmark" variant="regular"/>
                    </WaButton>

                    <h3 slot="header">
                        <WaIcon name="filter" variant="regular"/> "Filter Layers"
                    </h3>

                    <WaTooltip for="lgs--layers-filter-by-usage">"By Layer Usage"</WaTooltip>
                    <WaRadioGroup name="usage" orientation="horizontal" label-at-start
                                  id="lgs--layers-filter-by-usage"
                                  onChange={handleUsage}
                                  value={layers.filter.byUsage} size="small">
                        <span slot="label">"By Usage"</span>
                        <WaRadio value={ALL}>"All"</WaRadio>
                        <WaRadio value={UNLOCKED}>"Unlocked"</WaRadio>
                        <WaRadio value={LOCKED}>"Locked"</WaRadio>
                    </WaRadioGroup>

                    <WaTooltip for="lgs--layers-filter-by-countries">"By Countries"</WaTooltip>
                    <WaSelect multiple with-clear
                              onChange={handleCountries} size="small"
                              id="lgs--layers-filter-by-countries"
                              value={layers.filter.byCountries ?? []}
                              key="filter-by-countries"
                              placeholder="By countries"
                    >
                        {__.layersAndTerrainManager.countries.map((country) => {
                            const info = __.countries.get(country)
                            if (info) {
                                return (
                                    <WaOption key={info.code} value={info.code}>
                                        <img src={__.ui.ui.countryFlag(info.code)} alt={info.name}
                                             slot="start" className="country-flag"/>
                                        {info.name}
                                    </WaOption>
                                )
                            }
                            return null
                        })}
                    </WaSelect>

                    <WaTooltip for="lgs--layers-filter-by-name">"By Layer Name"</WaTooltip>
                    <WaInput placeholder="By name"
                             id="lgs--layers-filter-by-name"
                             onInput={handleName} size="small"
                             value={layers.filter.byName}
                             key="filter-by-name"
                             with-clear
                    />

                    <WaCallout
                        size="small"
                        variant={layers.filter.count === 0 ? 'danger' : 'neutral'}
                        className="map-poi-filter-count-info"
                    >
                        <WaIcon slot="icon" size="small" variant="regular"
                                name={layers.filter.count === 0 ? 'warning' : 'layer-group'}/>
                        <div>
                            <div>
                                <span>
                                    {layers.filter.count === 0 ? 'No layers match criteria.' : `Showing ${layers.filter.count} Layers`}
                                </span>
                                {layers.filter.count > 0 && <span>{getBreakdown()}</span>}
                            </div>
                            {layers.filter.count === 0 && (
                                <WaButton id="lgs--reset-layers-filters-callout" size="x-small" onClick={disableFilter}
                                          appearance="outlined" variant="danger" disabled={!layers.filter.active}>
                                    <WaIcon slot="start" size="small" variant="regular"
                                            name="filter-circle-xmark"/> "Reset"
                                </WaButton>
                            )}
                        </div>
                    </WaCallout>

                    <div slot="footer">
                        <div className="lgs--popup-in-drawer-footer">
                            <WaTooltip for="lgs--reset-filter-to-factory">"Reset Filters"</WaTooltip>
                            <WaButton id="lgs--reset-filter-to-factory"
                                      size="small" onClick={disableFilter}
                                      appearance="outlined"
                                      variant="brand"
                                      disabled={!layers.filter.active}
                            >
                                <WaIcon size="small" name="arrow-rotate-left"/> "Reset"
                            </WaButton>

                            <WaTooltip for="lgs--close-layer-settings">"Close settings"</WaTooltip>
                            <WaButton id="lgs--close-layer-settings"
                                      size="small"
                                      variant="brand"
                                      onClick={close}>
                                <WaIcon size="small" name="xmark" variant="regular"/> "Close"
                            </WaButton>
                        </div>
                    </div>

                </wa-card>
            }
        </>
    )
}