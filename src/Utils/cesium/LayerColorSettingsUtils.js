/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayerColorSettingsUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-25
 * Last modified on: 2026-06-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DEFAULT_LAYERS_COLOR_SETTINGS } from '@Core/constants'
import { LayersUtils } from '@Utils/cesium/LayersUtils'

export const ensureLayerColorSettings = ({layersProxy, selectedType}) => {
    const layerKey = layersProxy[selectedType]

    if (!layersProxy.colorSettings) {
        layersProxy.colorSettings = {[layerKey]: {...DEFAULT_LAYERS_COLOR_SETTINGS}}
    }

    if (!layersProxy.colorSettings[layerKey]) {
        layersProxy.colorSettings[layerKey] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
    }

    if (__.app.isEmpty(lgs.theDefaultColorSettings)) {
        lgs.theDefaultColorSettings = {...layersProxy.colorSettings[layerKey]}
    }

    LayersUtils.applySettings(layersProxy.colorSettings[layerKey], selectedType)
}
