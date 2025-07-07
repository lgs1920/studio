/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayersAndTerrains.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-07
 * Last modified: 2025-07-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faRegularSlidersSlash } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { LGSScrollbars }         from '@Components/MainUI/LGSScrollbars'
import { ALL, BASE_ENTITY, FREE_ANONYMOUS_ACCESS, OVERLAY_ENTITY, TERRAIN_ENTITY, UNLOCKED } from '@Core/constants'
import {
    faArrowDownAZ,
    faArrowDownBigSmall,
    faArrowDownWideShort,
    faArrowDownZA,
    faFilter,
    faFilterSlash,
    faGrid2,
    faList,
    faSliders,
}                                from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlTab, SlTabGroup, SlTabPanel, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'
import { useSnapshot }           from 'valtio'
import { ToggleStateIcon }       from '../../ToggleStateIcon'
import { FilterEntities }        from './FilterEntities'
import { LayerSettings }         from './LayerSettings'
import { SelectEntity }          from './SelectEntity'
import { TokenLayerModal }       from './TokenLayerModal'

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
     * Toggles the filter panel visibility
     */
    const handleFilter = () => ($editor.openFilter = !$editor.openFilter)

    /**
     * Toggles the settings panel visibility and resets settings changed flag
     */
    const handleSettings = () => {
        $editor.openSettings = !$editor.openSettings
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

                    // Apply filter by country
                    if (layers.filter.byCountries.length > 0) {
                        byCountries = layers.filter.byCountries.includes(layer.country)
                    }
                }

                if (byName && byUsage && byCountries) {
                    list.push(layer)
                }
            }
        });

        return list.sort(sortByProvider)
    };

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
            <FilterEntities/>
            <LayerSettings visible={canViewSettings}/>
            <SlTabGroup>
                <SlTab slot="nav" panel="tab-bases" onClick={() => ($editor.layer.selectedType = BASE_ENTITY)}>
                    {'Bases'}
                </SlTab>
                <SlTab slot="nav" panel="tab-overlays" onClick={() => ($editor.layer.selectedType = OVERLAY_ENTITY)}>
                    {'Overlays'}
                </SlTab>
                <SlTab slot="nav" panel="tab-terrains" onClick={() => ($editor.layer.selectedType = TERRAIN_ENTITY)}>
                    {'Terrains'}
                </SlTab>

                <div slot="nav" id="layers-and-terrains-filter">
                    <SlTooltip hoist content={layers.filter.thumbnail ? 'Display List' : 'Display Thumbnails'}>
                        <ToggleStateIcon
                            icons={{shown: faGrid2, hidden: faList}}
                            initial={layers.filter.thumbnail}
                            onChange={handleThumbnail}
                        />
                    </SlTooltip>
                    <SlTooltip hoist content={layers.filter.provider ? 'By Layer' : 'By Provider'}>
                        <ToggleStateIcon
                            icons={{shown: faArrowDownWideShort, hidden: faArrowDownBigSmall}}
                            initial={layers.filter.provider}
                            onChange={handleProvider}
                        />
                    </SlTooltip>
                    <SlTooltip hoist content={layers.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}>
                        <ToggleStateIcon
                            icons={{shown: faArrowDownAZ, hidden: faArrowDownZA}}
                            initial={layers.filter.alphabetic}
                            onChange={handleAlphabetic}
                        />
                    </SlTooltip>
                    <SlTooltip hoist content={editor.openSettings ? 'Hide Settings' : 'Show Settings'}>
                        <SlIconButton
                            library="fa"
                            disabled={!canViewSettings()}
                            name={FA2SL.set(editor.openSettings && canViewSettings() ? faRegularSlidersSlash : faSliders)}
                            onClick={handleSettings}
                            className={layers.filter.active ? 'layer-settings-active' : 'layer-settings-inactive'}
                        />
                    </SlTooltip>
                    <SlTooltip hoist content={editor.openFilter ? 'Hide Filters' : 'Show Filters'}>
                        <SlIconButton
                            library="fa"
                            name={FA2SL.set(editor.openFilter ? faFilterSlash : faFilter)}
                            onClick={handleFilter}
                            className={layers.filter.active ? 'layer-filter-active' : 'layer-filter-inactive'}
                        />
                    </SlTooltip>
                </div>

                <SlTabPanel name="tab-bases">
                    <SelectEntity key={getEntityKey(BASE_ENTITY)} type={BASE_ENTITY} list={buildList(BASE_ENTITY)}/>
                </SlTabPanel>
                <SlTabPanel name="tab-overlays">
                    <SelectEntity key={getEntityKey(OVERLAY_ENTITY)} type={OVERLAY_ENTITY}
                                  list={buildList(OVERLAY_ENTITY)}/>
                </SlTabPanel>
                <SlTabPanel name="tab-terrains">
                    <SelectEntity key={getEntityKey(TERRAIN_ENTITY)} type={TERRAIN_ENTITY}
                                  list={buildList(TERRAIN_ENTITY)}/>
                </SlTabPanel>
            </SlTabGroup>
            <TokenLayerModal/>
        </div>
    )
}