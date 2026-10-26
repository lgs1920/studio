/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiMoveStore.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { POI_TMP_TYPE } from '@Core/constants'

/** @typedef {{poiId: string, original: object}} POIMoveSession */

/** @type {POIMoveSession|null} */
let session = null
const listeners = new Set()

/** Notify subscribers after the active move session changes. */
const notify = () => listeners.forEach(listener => listener())

/** Get the current POI move session for React's external-store subscription. */
export const getPOIMoveSession = () => session

/** Subscribe to POI move session changes. */
export const subscribeToPOIMove = listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** Ephemeral state for the active POI move session. */
export const $poiMove = {
    get session() {
        return session
    },
    set session(nextSession) {
        if (session === nextSession) {
            return
        }

        session = nextSession
        notify()
    },
}

/** Start a POI move session when the POI has a valid map position. */
export const startPOIMove = poi => {
    if (!poi?.id || poi.type === POI_TMP_TYPE
        || poi.latitude == null || poi.longitude == null
        || !Number.isFinite(Number(poi.latitude)) || !Number.isFinite(Number(poi.longitude))) {
        return false
    }

    $poiMove.session = {
        poiId: poi.id,
        original: {
            longitude: poi.longitude,
            latitude: poi.latitude,
            height: poi.height,
            simulatedHeight: poi.simulatedHeight,
            expanded: poi.expanded === true,
            visible: poi.visible !== false,
        },
    }

    return true
}
