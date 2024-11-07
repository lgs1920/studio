import { ALL, BASE_LAYERS, FREE_ANONYMOUS_ACCESS, OVERLAY_LAYERS, TERRAIN_LAYERS, UNLOCKED } from '@Core/constants'
import { useSnapshot }                                                                        from 'valtio/index'
import { SelectEntity }                                                                      from './SelectEntity'

export const EntitiesList = () => {

    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(lgs.editorSettingsProxy)
    const layers = useSnapshot(lgs.settings.layers)

    const sortByProvider = (a, b) => {
        return a.provider.localeCompare(b.provider)
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

    return (
        <>
            {snap.layer.refreshList &&
                <>
                    {snap.layer.selectedType === BASE_LAYERS &&
                        <SelectEntity list={buildList(BASE_LAYERS).sort(sortByProvider)}/>
                    }
                    {snap.layer.selectedType === OVERLAY_LAYERS &&
                        <SelectEntity list={buildList(OVERLAY_LAYERS).sort(sortByProvider)}/>
                    }
                    {snap.layer.selectedType === TERRAIN_LAYERS &&
                        <SelectEntity list={buildList(TERRAIN_LAYERS).sort(sortByProvider)}/>
                    }
                </>
            }
            {editor.layer.refreshList = false}
        </>
    )
}