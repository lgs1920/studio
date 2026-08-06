/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: openPOIEditor.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { Utils }                                     from '@Editor/Utils'

const POIS_TAB = 'tab-pois'

const selectCurrentPOI = (poiId) => {
    if (!poiId) {
        return
    }

    const $pois = lgs.stores.main.components.pois
    if ($pois.current !== poiId) {
        $pois.current = poiId
    }
}

const syncJourneyTrack = (journey, trackSlug) => {
    if (!journey?.tracks?.has?.(trackSlug)) {
        return
    }

    const nextTrack = journey.tracks.get(trackSlug)
    const editorStore = lgs.theJourneyEditorProxy
    if (!nextTrack || editorStore.track?.slug === nextTrack.slug) {
        return
    }

    editorStore.track = nextTrack
    nextTrack.addToContext?.()
    nextTrack.addToEditor?.()
    Utils.renderTracksList()
    Utils.renderTrackSettings()
}

const prepareJourneyPOIEditor = async (poi) => {
    const journey = lgs.getJourneyByTrackSlug?.(poi.parent)
    if (!journey?.slug) {
        console.warn('[openPOIEditor] Cannot resolve journey for POI', poi.id, poi.parent)
        return false
    }

    const currentJourneySlug = lgs.theJourney?.slug ?? lgs.theJourneyEditorProxy?.journey?.slug ?? null
    if (currentJourneySlug !== journey.slug) {
        await Utils.updateJourneyEditor(journey.slug, {focus: false})
    }

    syncJourneyTrack(journey, poi.parent)

    const editorStore = lgs.theJourneyEditorProxy
    editorStore.poi = poi.id
    editorStore.activeTab = POIS_TAB
    editorStore.showPOIsFilter = true

    return true
}

export const openPOIEditor = async (poiOrId, options = {}) => {
    const poiId = typeof poiOrId === 'string' ? poiOrId : poiOrId?.id
    if (!poiId) {
        return false
    }

    const poi = lgs.stores.main.components.pois.list.get(poiId)
    if (!poi?.id) {
        return false
    }

    selectCurrentPOI(poi.id)

    const openJourneyEditor = poi.parent ? await prepareJourneyPOIEditor(poi) : false
    const drawer = openJourneyEditor ? JOURNEY_EDITOR_DRAWER : POIS_EDITOR_DRAWER

    __.ui.drawerManager.open(drawer, {
        action: 'edit-current',
        entity: poi.id,
        stacked: options.stacked === true,
        tab:    openJourneyEditor ? POIS_TAB : null,
    })

    return true
}
