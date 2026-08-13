/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: layerSelection.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { BASE3D_ENTITY, BASE_ENTITY, OVERLAY_ENTITY, TILES3D_ENTITY } from '@Core/constants'

export const applyLayerSelection = ({
    entity,
    id = entity?.id,
    requestedType = entity?.type,
    layersSnapshot,
    layersProxy,
    forceSelect = false,
}) => {
    if (!entity || !id || !layersProxy) {
        return
    }

    const isSelectedOverlay = !forceSelect && entity.type === OVERLAY_ENTITY && layersSnapshot?.overlay === id
    const isSelectedBase3D = !forceSelect && entity.type === BASE3D_ENTITY && layersSnapshot?.base3d === id
    const isSelectedTiles3D = !forceSelect && entity.type === TILES3D_ENTITY && layersSnapshot?.tiles3d === id

    if (entity.type === BASE3D_ENTITY) {
        layersProxy.base = ''
        layersProxy.base3d = isSelectedBase3D ? '' : id
    }
    else if (entity.type === BASE_ENTITY) {
        layersProxy.base3d = ''
        layersProxy.base = id
    }
    else if (entity.type === TILES3D_ENTITY) {
        layersProxy.overlay = ''
        layersProxy.tiles3d = isSelectedTiles3D ? '' : id
    }
    else if (entity.type === OVERLAY_ENTITY) {
        layersProxy.tiles3d = ''
        layersProxy.overlay = isSelectedOverlay ? '' : id
    }
    else {
        layersProxy[requestedType] = id
    }
}
