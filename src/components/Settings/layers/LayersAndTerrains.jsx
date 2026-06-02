/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayersAndTerrains.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { PopupAnchor }                  from '@Components/PopupAnchor'
import { LGSPopup }                     from '@Components/LGSPopup'
import { ALL, BASE_ENTITY, FREE_ANONYMOUS_ACCESS, OVERLAY_ENTITY, TERRAIN_ENTITY, UNLOCKED } from '@Core/constants'
import {
    WaButton, WaIcon, WaTab, WaTabGroup, WaTabPanel, WaTooltip,
}                                       from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                  from 'valtio'
import {
    ToggleStateIcon,
}                                       from '@Components/ToggleStateIcon'
import { LayersFilterPopup }            from './LayersFilterPopup'
import { LayersColorsAdjustementPopup } from './LayersColorsAdjustementPopup'
import { SelectEntity }                 from './SelectEntity'
import { TokenLayerModal } from './TokenLayerModal'

// Filter operator constants
const AND = '&'
const OR = '|'

/**
 * Layers and Terrains component for managing layer selection and filtering
 * @returns {JSX.Element} The rendered Layers and Terrains component
 */
export const LayersAndTerrains = () => {
    const $editor = lgs.editorSettingsProxy
    const editor = useSnapshot($editor)
    const $layers = lgs.settings.layers
    const layers = useSnapshot($layers)

    /**
     * Toggles the filter panel visibility and ensures settings are closed.
     */
    const handleFilter = () => {
        $editor.openFilter = !$editor.openFilter
        if ($editor.openFilter) {
            $editor.openSettings = false
        }
    }

    /**
     * Toggles the settings panel visibility and ensures filter is closed.
     */
    const handleSettings = () => {
        $editor.openSettings = !$editor.openSettings
        if ($editor.openSettings) {
            $editor.openFilter = false
        }
        $editor.settingsChanged = false
    }

    /**
     * Builds a filtered and sorted list of layers based on type and filter criteria
     * @param {string} type - The entity type (base, overlay, or terrain)
     * @returns {Array} Filtered and sorted list of layers
     */
    const buildList = (type) => {
        const list = []
        // Ensure layers is an array to prevent filter is not a function error
        __.layersAndTerrainManager.layers.forEach(layer => {
            if (layer?.type === type) {
                let byName = true
                let byUsage = true
                let byCountries = true

                if (layers.filter?.active) {
                    // Apply filter by name
                    if (layers.filter.byName && typeof layers.filter.byName === 'string') {
                        const criteria = layers.filter.byName.toLowerCase().trim()
                        const layerName = layer.name && typeof layer.name === 'string' ? layer.name.toLowerCase() : ''
                        if (criteria.includes(OR)) {
                            const criterias = criteria.split(OR)
                            byName = criterias.some(criterion => layerName.includes(criterion.trim()))
                        }
                        else if (criteria.includes(AND)) {
                            const criterias = criteria.split(AND)
                            byName = criterias.every(criterion => layerName.includes(criterion.trim()))
                        }
                        else {
                            byName = layerName.includes(criteria)
                        }
                    }

                    // Apply filter by usage
                    if (layers.filter.byUsage && layers.filter.byUsage !== ALL) {
                        const viewUnlocked = layers.filter.byUsage === UNLOCKED
                        byUsage = viewUnlocked
                                  ? layer.usage?.type === FREE_ANONYMOUS_ACCESS || layer.usage?.unlocked === true
                                  : layer.usage?.type !== FREE_ANONYMOUS_ACCESS && layer.usage?.unlocked !== true
                    }

                    // Apply filter by countries
                    if (layers.filter.byCountries.length > 0) {
                        byCountries = layer.countries.some(country => layers.filter.byCountries.includes(country))
                    }
                }

                if (byName && byUsage && byCountries) {
                    list.push(layer)
                }
            }
        })

        return list.sort(sortByProvider)
    }

    /**
     * Sorts layers by provider or name based on filter settings
     * @param {Object} left - First layer to compare
     * @param {Object} right - Second layer to compare
     * @returns {number} Comparison result for sorting
     */
    const sortByProvider = (left, right) => {
        const a = layers.filter.alphabetic ? left : right
        const b = layers.filter.alphabetic ? right : left
        // Ensure providerName and name are strings to prevent localeCompare errors
        const aProvider = typeof a.providerName === 'string' ? a.providerName : ''
        const bProvider = typeof b.providerName === 'string' ? b.providerName : ''
        const aName = typeof a.name === 'string' ? a.name : ''
        const bName = typeof b.name === 'string' ? b.name : ''

        if (layers.filter.provider) {
            return aProvider.localeCompare(bProvider) || aName.localeCompare(bName)
        }
        return aName.localeCompare(bName)
    }

    /**
     * Updates the provider filter setting
     * @param {boolean} provider - Whether to filter by provider
     */
    const handleProvider = (provider) => ($layers.filter.provider = provider)

    /**
     * Updates the thumbnail display setting
     * @param {boolean} thumbnail - Whether to display thumbnails
     */
    const handleThumbnail = (thumbnail) => ($layers.filter.thumbnail = thumbnail)

    /**
     * Updates the alphabetic sorting setting and triggers list refresh
     * @param {boolean} alphabetic - Whether to sort alphabetically
     */
    const handleAlphabetic = (alphabetic) => {
        $layers.filter.alphabetic = alphabetic
        $editor.layer.refreshList = true
    }

    /**
     * Determines if settings panel should be visible
     * @returns {boolean} Whether settings panel can be shown
     */
    const canViewSettings = () =>
        editor.layer.selectedType === BASE_ENTITY || (editor.layer.selectedType === OVERLAY_ENTITY && layers.overlay !== '')

    /**
     * Generates a unique key for entity components to optimize rendering
     * @param {string} type - The entity type
     * @returns {string} Unique key for the entity component
     */
    const getEntityKey = (type) =>
        `${type}-${layers.filter.byName || ''}-${layers.filter.byUsage || ''}-${layers.filter.alphabetic}`

    return (
        <div id="layers-and-terrains-settings">
            <LGSPopup active={editor.openFilter} anchor="layers-and-terrains-filter-separator"
                      onRequestClose={() => {
                          $editor.openFilter = false
                      }}
                     distance={lgs.gutter.s}
                     placement="top" flip shift>
                <LayersFilterPopup/>
            </LGSPopup>

            <LGSPopup active={editor.openSettings} anchor="layers-and-terrains-filter-separator"
                      onRequestClose={() => {
                          $editor.openSettings = false
                      }}
                     distance={lgs.gutter.s}
                     placement="top" flip shift>
                <LayersColorsAdjustementPopup visible={canViewSettings}/>
            </LGSPopup>


            <WaTabGroup className="lgs--layers-and-terrains-tabs">
                <WaTab panel="tab-bases"
                       onClick={() => ($editor.layer.selectedType = BASE_ENTITY)}>
                    {'Bases'}
                </WaTab>
                <WaTab panel="tab-overlays" onClick={() => ($editor.layer.selectedType = OVERLAY_ENTITY)}>
                    {'Overlays'}
                </WaTab>
                <WaTab panel="tab-terrains" onClick={() => ($editor.layer.selectedType = TERRAIN_ENTITY)}>
                    {'Terrains'}
                </WaTab>

                <div id="layers-and-terrains-filter" slot="nav">
                    <WaTooltip for="lgs--layers-list-or-grid">
                        {layers.filter.thumbnail ? 'Display List' : 'Display Thumbnails'}
                    </WaTooltip>
                    <ToggleStateIcon
                        id="lgs--layers-list-or-grid"
                        icons={{shown: 'grid-2', hidden: 'list'}}
                        initial={layers.filter.thumbnail}
                        onChange={handleThumbnail}
                        buttonVariant="brand"
                        iconVariant="regular"
                        iconFamily="regular"
                    />

                    <WaTooltip for="lgs--layers-layers-or-providers">
                        {layers.filter.provider ? 'By Layer' : 'By Provider'}
                    </WaTooltip>
                    <ToggleStateIcon
                        id="lgs--layers-layers-or-providers"
                        icons={{shown: 'arrow-down-wide-short', hidden: 'arrow-down-big-small'}}
                        initial={layers.filter.provider}
                        onChange={handleProvider}
                        buttonVariant="brand"
                        iconVariant="regular"
                        iconFamily="regular"
                    />
                    <WaTooltip for="lgs--layers-alphabetic-order">
                        {layers.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}
                    </WaTooltip>
                    <ToggleStateIcon
                        id="lgs--layers-alphabetic-order"
                        icons={{shown: 'arrow-down-a-z', hidden: 'arrow-down-z-a'}}
                        initial={layers.filter.alphabetic}
                        onChange={handleAlphabetic}
                        buttonVariant="brand"
                        iconVariant="regular"
                        iconFamily="regular"
                    />

                    <WaTooltip for="lgs--layers-settings-button">
                        {editor.openSettings ? 'Hide Color Adjustements' : 'Show Color Adjustements'}
                    </WaTooltip>
                    <WaButton id="lgs--layers-settings-button"
                              disabled={!canViewSettings()}
                              variant="brand"
                              appearance="plain"
                              onClick={handleSettings}
                              className={layers.filter.active ? 'layer-settings-active' : 'layer-settings-inactive'}>
                        <WaIcon id="lgs--layers-settings-button"
                                variant={'regular'}
                                name={editor.openSettings && canViewSettings() ? 'regular-sliders-slash' : 'sliders'}/>
                    </WaButton>

                    <WaTooltip for="lgs--layers-filter-button">
                        {`${editor.openFilter ? 'Hide Filters' : 'Show Filters'}${layers.filter.active ? ': Filter is active' : ''}`}
                    </WaTooltip>
                    <WaButton id="lgs--layers-filter-button"
                              appearance={layers.filter.active ? 'filled' : 'plain'}
                              onClick={handleFilter}
                              variant={layers.filter.active ? 'danger' : 'brand'}>
                        <WaIcon variant="regular"
                                name={editor.openFilter ? 'filter-slash' : 'filter'}/>
                    </WaButton>

                </div>

                <PopupAnchor id="layers-and-terrains-filter-separator"/>

                <WaTabPanel name="tab-bases">
                    <SelectEntity key={getEntityKey(BASE_ENTITY)} type={BASE_ENTITY} list={buildList(BASE_ENTITY)}/>
                </WaTabPanel>
                <WaTabPanel name="tab-overlays">
                    <SelectEntity key={getEntityKey(OVERLAY_ENTITY)} type={OVERLAY_ENTITY}
                                  list={buildList(OVERLAY_ENTITY)}/>
                </WaTabPanel>
                <WaTabPanel name="tab-terrains">
                    <SelectEntity key={getEntityKey(TERRAIN_ENTITY)} type={TERRAIN_ENTITY}
                                  list={buildList(TERRAIN_ENTITY)}/>
                </WaTabPanel>
            </WaTabGroup>

            <TokenLayerModal/>
        </div>
    )
}
