import { BASE_LAYERS, OVERLAY_LAYERS, TERRAIN_LAYERS } from '@Core/constants'
import { useSnapshot }                                 from 'valtio'
import { SelectEntity }                                from './SelectEntity'
import { SelectLayerType }                             from './SelectLayerType'

export const LayersAndTerrains = () => {

    const settings = lgs.settingsEditorProxy
    const snap = useSnapshot(settings)

    const bases = []
    const overlays = []
    const terrains = []

    const sortByProvider = (a, b) => {
        return a.provider.localeCompare(b.provider)
    }

    // Build base and overlays list
    __.layerManager.layers.forEach(layer => {
        if (layer.type === 'base') {
            bases.push(layer)
        }
        else {
            overlays.push(layer)
        }
    })

    return (
        <div id="layers-and-terrains-settings">
            <SelectLayerType/>
            <div>
                {snap.layers.selectedType === BASE_LAYERS &&
                    <SelectEntity list={bases.sort(sortByProvider)}/>
                }
                {snap.layers.selectedType === OVERLAY_LAYERS &&
                    <SelectEntity list={overlays.sort(sortByProvider)}/>
                }
                {snap.layers.selectedType === TERRAIN_LAYERS &&
                    <SelectEntity list={terrains.sort(sortByProvider)}/>
                }
            </div>
        </div>

    )
}