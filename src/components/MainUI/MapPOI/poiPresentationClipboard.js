/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiPresentationClipboard.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-05
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {normalizePOIDisplaySettings} from '@Core/POIDisplaySettings'
import {useCallback} from 'react'
import {proxy, useSnapshot} from 'valtio'

/** Ephemeral in-app buffer for one POI's presentation settings. */
export const poiPresentationClipboardStore = proxy({entry: null})

/**
 * Copy the POI's colors and Content/Decoration settings without its identifying details.
 * @param {Object|null|undefined} poi - Source POI record.
 * @returns {boolean} Whether presentation settings were copied.
 */
export const copyPOIPresentation = poi => {
    if (!poi?.id) {
        return false
    }

    poiPresentationClipboardStore.entry = {
        sourcePoiId: poi.id,
        updates: {
            color: poi.color,
            bgColor: poi.bgColor,
            borderColor: poi.borderColor,
            textBorderColorsLinked: poi.textBorderColorsLinked === true,
            background: poi.background !== false,
            display: normalizePOIDisplaySettings(poi.display),
        },
    }

    return true
}

/** Return a detached copy of the buffered presentation settings. */
export const readPOIPresentationClipboard = () => {
    const entry = poiPresentationClipboardStore.entry
    if (!entry) {
        return null
    }

    return {
        sourcePoiId: entry.sourcePoiId,
        updates: {
            ...entry.updates,
            display: {...entry.updates.display},
        },
    }
}

/** Share copy and reusable paste actions between the map menu and POI editor. */
export const usePOIPresentationClipboard = poiId => {
    const clipboard = useSnapshot(poiPresentationClipboardStore)

    const copy = useCallback(() => {
        const poi = lgs.stores.main.components.pois.list.get(poiId)
        return copyPOIPresentation(poi)
    }, [poiId])

    const paste = useCallback(async () => {
        const entry = readPOIPresentationClipboard()
        if (!entry) {
            return false
        }

        const updatedPOI = await __.ui.poiManager.updatePOI(poiId, {
            ...entry.updates,
            visible: true,
        }, {markAsEdited: true})
        if (!updatedPOI) {
            return false
        }

        return true
    }, [poiId])

    return {
        canPaste: Boolean(clipboard.entry),
        copy,
        paste,
    }
}
