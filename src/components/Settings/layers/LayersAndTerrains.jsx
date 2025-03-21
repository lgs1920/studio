/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayersAndTerrains.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-24
 * Last modified: 2025-02-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faRegularSlidersSlash }                                                             from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { ALL, BASE_ENTITY, FREE_ANONYMOUS_ACCESS, OVERLAY_ENTITY, TERRAIN_ENTITY, UNLOCKED } from '@Core/constants'
import {
    faArrowDownAZ, faArrowDownBigSmall, faArrowDownWideShort, faArrowDownZA, faFilter, faFilterSlash, faGrid2, faList,
    faSliders,
}                                                                                            from '@fortawesome/pro-regular-svg-icons'

import { SlIconButton, SlTab, SlTabGroup, SlTabPanel, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                  from '@Utils/FA2SL'
import { useSnapshot }                                            from 'valtio'
import { ToggleStateIcon }                                        from '../../ToggleStateIcon'
import { FilterEntities }                                         from './FilterEntities'
import { LayerSettings }                                          from './LayerSettings'
import { SelectEntity }                                           from './SelectEntity'
import { TokenLayerModal }                                        from './TokenLayerModal'


export const LayersAndTerrains = () => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)

    const handleFilter = () => editor.openFilter = !editor.openFilter
    const handleSettings = () => {
        editor.openSettings = !editor.openSettings
        editor.settingsChanged = false
    }


    /**
     * Build  entities list.
     * If  filter is active, weapply it here.
     *
     *  @param type entity type ie (base, overlay or terrain)
     *
     */
    const buildList = (type) => {
        const list = []
        __.layersAndTerrainManager.layers.forEach(layer => {
            const AND = '&', OR = '|'
            if (layer.type === type) {
                let byName = true, byUsage = true
                if (layers.filter.active) {
                    // Apply filter by name
                    if (layers.filter.byName) {

                        // accepted: one criterion : string,
                        //           one of criteria (or) : string | strong | strange
                        //           all criteria (and) : string & strong & strange

                        //   mix beetween & and | is not a valid criterion

                        const _or = layers.filter.byName.includes(OR)
                        if (_or) {
                            const criterias = layers.filter.byName.split(OR)
                            byName = criterias.some(criterion => layer.name.toLowerCase().includes(criterion.toLowerCase().trim()))
                        }
                        else {
                            const _and = layers.filter.byName.includes(AND)
                            if (_and) {
                                const criterias = layers.filter.byName.split(AND)
                                byName = criterias.every(criterion => layer.name.toLowerCase().includes(criterion.toLowerCase().trim()))
                            }
                            else {
                                byName = layer.name.toLowerCase().includes(layers.filter.byName.toLowerCase().trim())
                            }
                        }
                    }
                    // Apply filter by usage
                    if (layers.filter.byUsage !== ALL) {
                        const viewUnlocked = layers.filter.byUsage === UNLOCKED
                        if (viewUnlocked) {
                            byUsage = layer.usage.type === FREE_ANONYMOUS_ACCESS || layer.usage.unlocked === true
                        }
                        else {
                            byUsage = layer.usage.type !== FREE_ANONYMOUS_ACCESS && layer.usage?.unlocked !== true
                        }
                    }
                }
                if (byName && byUsage) {
                    list.push(layer)
                }
            }
        })
        return list
    }

    const sortByProvider = (left, right) => {
        // If we display provider
        const a = (layersSnap.filter.alphabetic) ? left : right
        const b = (layersSnap.filter.alphabetic) ? right : left

        if (layersSnap.filter.provider) {
            if (a.providerName < b.providerName) {
                return -1
            }
            if (a.providerName > b.providerName) {
                return 1
            }
            if (a.name < b.name) {
                return -1
            }
            if (a.name > b.name) {
                return 1
            }
            return 0
        }
        if (a.name < b.name) {
            return -1
        }
        if (a.name > b.name) {
            return 1
        }
        return 0
    }

    const handleProvider = (provider) => layers.filter.provider = provider
    const handleThumbnail = (thumbnail) => layers.filter.thumbnail = thumbnail
    const handleAlphabetic = (alphabetic) => {
        layers.filter.alphabetic = alphabetic
        editor.layer.refreshList = true
    }

    const canViewSettings = () => {
        let can = snap.layer.selectedType === BASE_ENTITY
        if (snap.layer.selectedType === OVERLAY_ENTITY) {
            can = layersSnap.overlay !== ''
        }
        return can
    }

    return (
        <>
            <div id="layers-and-terrains-settings">

                <SlTabGroup>
                    <SlTab slot="nav" panel="tab-bases"
                           onClick={() => editor.layer.selectedType = BASE_ENTITY}>{'Bases'}</SlTab>
                    <SlTab slot="nav" panel="tab-overlays"
                           onClick={() => editor.layer.selectedType = OVERLAY_ENTITY}>{'Overlays'}</SlTab>
                    <SlTab slot="nav" panel="tab-terrains"
                           onClick={() => editor.layer.selectedType = TERRAIN_ENTITY}>{'Terrains'}</SlTab>
                    <div slot="nav" id={'layers-and-terrains-filter'}>

                        <SlTooltip hoist content={layersSnap.filter.thumbnail ? 'Display List' : 'Display Thumbnails'}>
                            <ToggleStateIcon icons={{shown: faGrid2, hidden: faList}}
                                             initial={layersSnap.filter.thumbnail}
                                             onChange={handleThumbnail}
                            />
                        </SlTooltip>
                        <SlTooltip hoist content={layersSnap.filter.provider ? 'By Layer' : 'By Provider'}>
                            <ToggleStateIcon icons={{shown: faArrowDownWideShort, hidden: faArrowDownBigSmall}}
                                             initial={layersSnap.filter.provider}
                                             onChange={handleProvider}
                            />
                        </SlTooltip>

                        <SlTooltip hoist content={layersSnap.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}>
                            <ToggleStateIcon icons={{shown: faArrowDownAZ, hidden: faArrowDownZA}}
                                             initial={layersSnap.filter.alphabetic}
                                             onChange={handleAlphabetic}
                            />
                        </SlTooltip>

                        <SlTooltip hoist content={snap.openSettings ? 'Hide Settings' : 'Show Settings'}>
                            <SlIconButton library="fa"
                                          disabled={!canViewSettings()}
                                          name={FA2SL.set(snap.openSettings && canViewSettings() ? faRegularSlidersSlash : faSliders)}
                                          onClick={handleSettings}
                                          className={layersSnap.filter.active ? 'layer-settings-active' : 'layer-settings-inactive'}/>
                        </SlTooltip>

                        <SlTooltip hoist content={snap.openFilter ? 'Hide Filters' : 'Show Filters'}>
                            <SlIconButton library="fa"
                                          name={FA2SL.set(snap.openFilter ? faFilterSlash : faFilter)}
                                          onClick={handleFilter}
                                          className={layersSnap.filter.active ? 'layer-filter-active' : 'layer-filter-inactive'}/>
                        </SlTooltip>
                    </div>
                    <FilterEntities/>
                    <LayerSettings visible={canViewSettings}/>
                    <SlTabPanel name="tab-bases">

                            <SelectEntity
                                key={`${BASE_ENTITY}-${layersSnap.filter.byName}-${layersSnap.filter.byUsage}-${layersSnap.filter.alphabetic}`}
                                list={buildList(BASE_ENTITY).sort(sortByProvider)}/>


                    </SlTabPanel>

                    <SlTabPanel name="tab-overlays">
                        {snap.layer.refreshList &&
                            <SelectEntity
                                key={`${OVERLAY_ENTITY}-${layersSnap.filter.byName}-${layersSnap.filter.byUsage}-${layersSnap.filter.alphabetic}`}
                                list={buildList(OVERLAY_ENTITY).sort(sortByProvider)}/>
                        }
                    </SlTabPanel>
                    <SlTabPanel name="tab-terrains">

                        {snap.layer.refreshList &&
                            <SelectEntity
                                key={`${TERRAIN_ENTITY}-${layersSnap.filter.byName}-${layersSnap.filter.byUsage}-${layersSnap.filter.alphabetic}`}
                                list={buildList(TERRAIN_ENTITY).sort(sortByProvider)}/>
                        }
                    </SlTabPanel>
                </SlTabGroup>
                <TokenLayerModal/>
            </div>
        </>
    )
}