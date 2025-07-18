/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Utils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-02
 * Last modified: 2025-07-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, DRAWING_FROM_UI, JUST_SAVE, NO_FOCUS, REFRESH_DRAWING, UPDATE_JOURNEY_SILENTLY,
}                     from '@Core/constants'
import { Journey }    from '@Core/Journey'
import { Track }      from '@Core/Track'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

export class Utils {

    /**
     * We change its key to rerender the list component
     */
    static renderJourneysList = () => {
        lgs.stores.main.components.journeyEditor.keys.journey.list++
    }

    static renderTracksList = () => {
        lgs.stores.main.components.journeyEditor.keys.track.list++
    }
    static renderJourneySettings = () => {
        lgs.stores.main.components.journeyEditor.keys.journey.settings++
    }

    static renderTrackSettings = () => {
        lgs.stores.main.components.journeyEditor.keys.track.settings++
    }

    static initJourneyEdition = async (event = undefined) => {
        if (window.isOK(event)) {
            Utils.updateJourneyEditor(event.target.value, {})
        }
    }
    static updateJourneyEditor = async (journeySlug, {
        rotate = lgs.settings.ui.camera.start.rotate.journey,
        action = DRAWING_FROM_UI,
        focus = true,
    }) => {
        const editorStore = lgs.theJourneyEditorProxy
        editorStore.journey = lgs.getJourneyBySlug(journeySlug)

        lgs.saveJourneyInContext(editorStore.journey)
        editorStore.journey.addToContext()
        editorStore.journey.addToEditor()
        // Force Tab to Data

        // Force Track and POI in editor
        editorStore.track = Array.from(editorStore.journey.tracks.values())[0]
        editorStore.track.addToContext()
        editorStore.track.addToEditor()

        editorStore.poi = null
        // Force rerender
        Utils.renderJourneysList()
        Utils.renderJourneySettings()
        Utils.renderTracksList()
        Utils.renderTrackSettings()

        //TODO manage 'journey/change' event and externalise profile management

        // Profile management
        TrackUtils.setProfileVisibility(editorStore.journey)

        // Update Profile to show the correct Journey
        __.ui.profiler.draw()

        // Save information
        TrackUtils.saveCurrentJourneyToDB(lgs.theJourney).then(async () => {
            if (editorStore.journey.visible && focus) {
                lgs.theJourney.focus({action: action, rotate: rotate})
            }
            await TrackUtils.saveCurrentJourneyToDB(lgs.theJourney)
            await TrackUtils.saveCurrentTrackToDB(null)
            await TrackUtils.saveCurrentPOIToDB(null)
        })

    }

    static initTrackEdition = async (event) => {
        if (window.isOK(event)) {
            const editorStore = lgs.theJourneyEditorProxy
            editorStore.track = lgs.getTrackBySlug(event.target.value)
            editorStore.track.addToContext()

            // Force POI in editor
            editorStore.poi = null

            // Force rerender
            Utils.renderTracksList()
            Utils.renderTrackSettings()

            // Save information
            TrackUtils.saveCurrentTrackToDB(event.target.value).then(async () => {
                if (editorStore.journey.visible) {
                    editorStore.journey.focus({rotate: lgs.settings.ui.camera.start.rotate.journey})
                }
                await TrackUtils.saveCurrentPOIToDB(null)

            })

        }
    }

    static updateTrack = async (action) => {

        // Update the track
        lgs.theJourneyEditorProxy.journey.tracks.set(lgs.theJourneyEditorProxy.track.slug, lgs.theJourneyEditorProxy.track)
        const journey = Journey.deserialize({object: Journey.unproxify(lgs.theJourneyEditorProxy.journey)})
        const track = Track.deserialize({object: Track.unproxify(lgs.theJourneyEditorProxy.track)})
        //TODO compute only if it is necessary
        if (action === DRAW_WITHOUT_SAVE || action === DRAW_THEN_SAVE) {
            await track.draw({action: REFRESH_DRAWING, mode: NO_FOCUS})
        }
        if (action === DRAW_THEN_SAVE || action === JUST_SAVE) {
            await journey.persistToDatabase()
        }

        await track.extractMetrics()
        lgs.saveJourneyInContext(journey)

    }

    /**
     * Re build the journey object,
     * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @param {Number} action
     * @return {Journey}
     */
    static updateJourney = async action => {

        const journey = Journey.deserialize({object: Journey.unproxify(lgs.theJourneyEditorProxy.journey)})
        await journey.extractMetrics()
        lgs.saveJourneyInContext(journey)

        await journey.persistToDatabase()

        TrackUtils.setProfileVisibility(journey)

        if (action !== UPDATE_JOURNEY_SILENTLY) {
            await journey.draw({action: action})
        } else {
            journey.focus({action: action, rotate: lgs.settings.ui.camera.start.rotate.journey})
        }

        return journey
    }

    settings = () => {
        lgs.stores.main.components.journeyEditor.keys.journey.settings++
    }


}