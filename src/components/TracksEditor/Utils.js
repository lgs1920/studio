/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Utils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, DRAWING_FROM_UI, JUST_SAVE, NO_FOCUS, REFRESH_DRAWING, UPDATE_JOURNEY_SILENTLY,
}                     from '@Core/constants'
import { Journey }    from '@Core/Journey'
import { Track }      from '@Core/Track'
import { getGlobalHideOtherJourneys, refreshJourneyVisibility } from '@Core/ui/JourneyVisibility'
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
        const journeySlug = event?.target?.value
        const editorStore = lgs.theJourneyEditorProxy

        if (!journeySlug) {
            return
        }

        if (editorStore.journey?.slug === journeySlug) {
            __.ui.drawerManager.consumeSuppressFocusOnOpen?.(journeySlug)
            return
        }

        Utils.updateJourneyEditor(journeySlug, {})
    }
    static updateJourneyEditor = async (journeySlug, {
        rotate = lgs.settings.ui.camera.start.rotate.journey,
        action = DRAWING_FROM_UI,
        focus = true,
    }) => {
        const editorStore = lgs.theJourneyEditorProxy
        const shouldFocus = focus && !__.ui.drawerManager.consumeSuppressFocusOnOpen?.(journeySlug)
        // Switching journeys must clear any active orbit/panorama state first, otherwise the
        // live camera updates keep reusing the previous journey anchor as a forced focus point.
        await __.ui.poiManager.stopRotationAndSync()
        lgs.stores.ui.mainUI.rotate.target = null
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
        await TrackUtils.saveCurrentJourneyToDB(lgs.theJourney)
        if (editorStore.journey.visible && shouldFocus) {
            lgs.theJourney.focus({action, rotate, resetCamera: true})
        }
        if (getGlobalHideOtherJourneys()) {
            await refreshJourneyVisibility({
                hideOtherJourneys: true,
                currentJourney:    editorStore.journey,
            })
        }
        await TrackUtils.saveCurrentTrackToDB(null)
        await TrackUtils.saveCurrentPOIToDB(null)

    }

    static initTrackEdition = async (event) => {
        const trackSlug = event?.target?.value
            const editorStore = lgs.theJourneyEditorProxy

        if (!trackSlug || editorStore.track?.slug === trackSlug) {
            __.ui.drawerManager.consumeSuppressFocusOnOpen?.(editorStore.journey?.slug)
            return
        }

        const shouldFocus = !__.ui.drawerManager.consumeSuppressFocusOnOpen?.(editorStore.journey?.slug)
        editorStore.track = lgs.getTrackBySlug(trackSlug)
            editorStore.track.addToContext()

            // Force POI in editor
            editorStore.poi = null

            // Force rerender
            Utils.renderTracksList()
            Utils.renderTrackSettings()

            // Save information
        TrackUtils.saveCurrentTrackToDB(trackSlug).then(async () => {
            if (editorStore.journey.visible && shouldFocus) {
                    editorStore.journey.focus({rotate: lgs.settings.ui.camera.start.rotate.journey})
                }
                await TrackUtils.saveCurrentPOIToDB(null)

            })

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
    static updateJourney = async (action, {focus = action !== UPDATE_JOURNEY_SILENTLY} = {}) => {

        const journey = Journey.deserialize({object: Journey.unproxify(lgs.theJourneyEditorProxy.journey)})
        await journey.extractMetrics()
        lgs.saveJourneyInContext(journey)

        await journey.persistToDatabase()

        TrackUtils.setProfileVisibility(journey)

        if (action !== UPDATE_JOURNEY_SILENTLY) {
            await journey.draw({action: action})
            if (getGlobalHideOtherJourneys()) {
                await refreshJourneyVisibility({
                    hideOtherJourneys: true,
                    currentJourney:    journey,
                })
            }
        }
        else if (focus) {
            journey.focus({action: action, rotate: lgs.settings.ui.camera.start.rotate.journey})
        }

        return journey
    }

    static refreshJourneysStatistics = async (activityId, {focus = false} = {}) => {
        const editorJourney = lgs.theJourneyEditorProxy?.journey
        const editorSlug = editorJourney?.slug ?? null
        const journeys = Array.from(lgs.journeys.values()).filter(journey => journey?.activity === activityId)
        const orderedJourneys = editorSlug
                                ? [
                                    ...journeys.filter(journey => journey?.slug === editorSlug),
                                    ...journeys.filter(journey => journey?.slug !== editorSlug),
                                ]
                                : journeys
        let updatedCurrentJourney = null
        const yieldToMainThread = () => new Promise(resolve => {
            const idleCallback = globalThis.requestIdleCallback
            if (typeof idleCallback === 'function') {
                idleCallback(() => resolve(), {timeout: 100})
                return
            }

            setTimeout(resolve, 0)
        })

        for (const [index, journey] of orderedJourneys.entries()) {
            if (journey?.slug === editorSlug) {
                updatedCurrentJourney = await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus})
            }
            else {
                await journey.extractMetrics()
                lgs.saveJourneyInContext(journey)
            }

            if (index < orderedJourneys.length - 1) {
                await yieldToMainThread()
            }
        }

        if (updatedCurrentJourney) {
            updatedCurrentJourney.addToContext()
            const track = updatedCurrentJourney.tracks.get(lgs.theJourneyEditorProxy.track?.slug)
                         ?? Array.from(updatedCurrentJourney.tracks.values())[0]
            track?.addToContext()
            track?.addToEditor()
            TrackUtils.setProfileVisibility(updatedCurrentJourney)
        }

        Utils.renderJourneySettings()
        __.ui.profiler?.draw()

        return updatedCurrentJourney
    }

    settings = () => {
        lgs.stores.main.components.journeyEditor.keys.journey.settings++
    }


}
