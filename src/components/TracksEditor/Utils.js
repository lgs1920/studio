import { Journey, NO_FOCUS, RE_LOADING }                from '@Core/Journey'
import { Track }                                        from '@Core/Track'
import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, JUST_SAVE } from '@Core/LGS1920Context'
import { TrackUtils }                                   from '@Utils/cesium/TrackUtils'
import { UPDATE_JOURNEY_SILENTLY }                      from './journey/JourneySettings'

export class Utils {

    /**
     * We change its key to rerender the list component
     */
    static renderJourneysList = () => {
        lgs.mainProxy.components.journeyEditor.keys.journey.list++
    }

    static renderTracksList = () => {
        lgs.mainProxy.components.journeyEditor.keys.track.list++
    }
    static renderJourneySettings = () => {
        lgs.mainProxy.components.journeyEditor.keys.journey.settings++
    }

    static renderTrackSettings = () => {
        lgs.mainProxy.components.journeyEditor.keys.track.settings++
    }

    static initJourneyEdition = (event = undefined) => {
        if (isOK(event)) {
            const editorStore = lgs.theJourneyEditorProxy
            editorStore.journey = lgs.getJourneyBySlug(event.target.value)
            lgs.saveJourney(editorStore.journey)

            editorStore.journey.addToContext()
            // Force Tab to Data
            editorStore.tabs.journey.data = true

            // Force Track and POI in editor
            editorStore.track = Array.from(editorStore.journey.tracks.values())[0]
            editorStore.track.addToContext()
            // Force tab to data
            editorStore.tabs.track.data = true
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
            lgs.profileTrackMarker.toggleVisibility()

            // Update Profile to show the correct Journey
            __.ui.profiler.draw()

            // Save information
            TrackUtils.saveCurrentJourneyToDB(event.target.value).then(async () => {
                if (editorStore.journey.visible) {
                    lgs.theJourney.focus()
                }

                await TrackUtils.saveCurrentTrackToDB(null)
                await TrackUtils.saveCurrentPOIToDB(null)
            })

        }
    }
    static initTrackEdition = (event) => {
        if (isOK(event)) {
            const editorStore = lgs.theJourneyEditorProxy
            editorStore.track = lgs.getTrackBySlug(event.target.value)
            editorStore.track.addToContext()
            // Force tab to data
            editorStore.tabs.track.data = true

            // Force POI in editor
            editorStore.poi = null

            // Force rerender
            Utils.renderTracksList()
            Utils.renderTrackSettings()

            // Save information
            TrackUtils.saveCurrentTrackToDB(event.target.value).then(async () => {
                if (editorStore.journey.visible) {
                    editorStore.journey.focus()
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
        await track.extractMetrics()


        if (action === DRAW_THEN_SAVE || action === JUST_SAVE) {
            lgs.saveJourney(journey)
            // saveToDB toDB
            await journey.saveToDB()
        }

        if (action === DRAW_WITHOUT_SAVE || action === DRAW_THEN_SAVE) {
            await track.draw({action: RE_LOADING, mode: NO_FOCUS})
        }

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
        lgs.saveJourney(journey)
        // saveToDB toDB
        await journey.saveToDB()

        TrackUtils.setProfileVisibility(journey)

        if (action !== UPDATE_JOURNEY_SILENTLY) {
            await journey.draw({action: action})
        } else {
            journey.focus()
        }
        return journey
    }

    /**
     * Adapt the profile with to the state of the editor pane
     */
    static changeProfileWidth = () => {
        const width = (lgs.mainProxy.components.journeyEditor.show) ? `calc( 100% - ${__.ui.css.getCSSVariable('--lgs-drawer-size')}` : '100%'
        __.ui.css.setCSSVariable('--lgs-profile-pane-width', width)
    }

    settings = () => {
        lgs.mainProxy.components.journeyEditor.keys.journey.settings++
    }


}