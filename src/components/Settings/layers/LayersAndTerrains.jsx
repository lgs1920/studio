import { ALL, BASE_LAYERS, FREE_ANONYMOUS_ACCESS, OVERLAY_LAYERS, TERRAIN_LAYERS, UNLOCKED } from '@Core/constants'
import {
    faFilter, faFilterSlash,
}                                                                                            from '@fortawesome/pro-regular-svg-icons'

import { SlIconButton, SlTab, SlTabGroup, SlTabPanel, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import React                                                      from 'react'
import { useSnapshot }                                            from 'valtio'
import { FA2SL }                                                  from '../../../Utils/FA2SL'

import { FilterEntities }  from './FilterEntities'
import { SelectEntity }    from './SelectEntity'
import { TokenLayerModal } from './TokenLayerModal'

export const LayersAndTerrains = () => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)

    const handleFilter = () => {
        editor.openFilter = !editor.openFilter
    }
    /**
     * Build  entities list.
     * If  filter isssctive, weapply it here.
     *
     *  @param type entity type ie (base, overlay or terrain)
     *
     */
    const buildList = (type) => {
        const list = []
        __.layerManager.layers.forEach(layer => {
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

    const sortByProvider = (a, b) => {
        return a.provider.localeCompare(b.provider)
    }


    return (
        <>
            <div id="layers-and-terrains-settings">

                <SlTabGroup>
                    <SlTab slot="nav" panel="tab-bases">{'Bases'}</SlTab>
                    <SlTab slot="nav" panel="tab-overlays">{'Overlays'}</SlTab>
                    {/* <SlTab slot="nav" panel="tab-terrains">{'Terrains'}</SlTab> */}
                    <div slot="nav" id={'layers-and-terrains-filter'}>
                        <SlTooltip hoist content={snap.openFilter ? 'Hide Filters' : 'Show Filters'}>
                            <SlIconButton library="fa"
                                          name={FA2SL.set(snap.openFilter ? faFilterSlash : faFilter)}
                                          onClick={handleFilter}
                                          className={layersSnap.filter.active ? 'layer-filter-active' : 'layer-filter-inactive'}/>
                        </SlTooltip>
                    </div>
                    <FilterEntities/>

                    <SlTabPanel name="tab-bases">

                        {snap.layer.refreshList &&
                            <SelectEntity
                                key={`${BASE_LAYERS}-${layersSnap.filter.byName}-${layersSnap.filter.byUsage}`}
                                list={buildList(BASE_LAYERS).sort(sortByProvider)}/>
                        }

                    </SlTabPanel>

                    <SlTabPanel name="tab-overlays">
                        {snap.layer.refreshList &&
                            <SelectEntity
                                key={`${OVERLAY_LAYERS}-${layersSnap.filter.byName}-${layersSnap.filter.byUsage}`}
                                list={buildList(OVERLAY_LAYERS).sort(sortByProvider)}/>
                        }
                    </SlTabPanel>
                    <SlTabPanel name="tab-terrains">

                        {snap.layer.refreshList &&
                            <SelectEntity
                                key={`${TERRAIN_LAYERS}-${layersSnap.filter.byName}-${layersSnap.filter.byUsage}`}
                                list={buildList(TERRAIN_LAYERS).sort(sortByProvider)}/>
                        }

                    </SlTabPanel>
                </SlTabGroup>
                {editor.layer.refreshList = false}

                <TokenLayerModal/>
            </div>
        </>
    )
}