import { Journey, NO_FOCUS, RE_LOADING }                from '@Core/Journey'
import { Track }                                        from '@Core/Track'
import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, JUST_SAVE } from '@Core/VT3D'
import { TrackUtils }                                   from '@Utils/cesium/TrackUtils'
import { UPDATE_JOURNEY_SILENTLY }                      from './journey/JourneySettings'

export class Utils {

    /**
     * We change its key to rerender the list component
     */
    static renderJourneysList = () => {
        vt3d.mainProxy.components.journeyEditor.keys.journey.list++
    }

    static renderTracksList = () => {
        vt3d.mainProxy.components.journeyEditor.keys.track.list++
    }
    static renderJourneySettings = () => {
        vt3d.mainProxy.components.journeyEditor.keys.journey.settings++
    }

    static renderTrackSettings = () => {
        vt3d.mainProxy.components.journeyEditor.keys.track.settings++
    }

    static initJourneyEdition = (event = undefined) => {
        if (isOK(event)) {
            const editorStore = vt3d.theJourneyEditorProxy
            editorStore.journey = vt3d.getJourneyBySlug(event.target.value)
            vt3d.saveJourney(editorStore.journey)

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


            // Save information
            TrackUtils.saveCurrentJourneyToDB(event.target.value).then(
                async () => {
                    if (editorStore.journey.visible) {
                        vt3d.theJourney.focus()
                    }

                    await TrackUtils.saveCurrentTrackToDB(null)
                    await TrackUtils.saveCurrentPOIToDB(null)
                },
            )

        }
    }
    static initTrackEdition = (event) => {
        if (isOK(event)) {
            const editorStore = vt3d.theJourneyEditorProxy
            editorStore.track = vt3d.getTrackBySlug(event.target.value)
            editorStore.track.addToContext()
            // Force tab to data
            editorStore.tabs.track.data = true

            // Force POI in editor
            editorStore.poi = null

            // Force rerender
            Utils.renderTracksList()
            Utils.renderTrackSettings()
            // Save information
            TrackUtils.saveCurrentTrackToDB(event.target.value).then(
                async () => {
                    if (editorStore.journey.visible) {
                        editorStore.journey.focus()
                    }
                    await TrackUtils.saveCurrentPOIToDB(null)
                },
            )

        }
    }

    static updateTrack = async (action) => {

        // Update the track
        vt3d.theJourneyEditorProxy.journey.tracks.set(vt3d.theJourneyEditorProxy.track.slug, vt3d.theJourneyEditorProxy.track)
        const journey = Journey.deserialize({object: Journey.unproxify(vt3d.theJourneyEditorProxy.journey)})
        const track = Track.deserialize({object: Track.unproxify(vt3d.theJourneyEditorProxy.track)})
        //TODO compute only if it is necessary
        //await track.computeAll()


        if (action === DRAW_THEN_SAVE || action === JUST_SAVE) {
            vt3d.saveJourney(journey)
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

        const journey = Journey.deserialize({object: Journey.unproxify(vt3d.theJourneyEditorProxy.journey)})
        await journey.computeAll()
        vt3d.saveJourney(journey)
        // saveToDB toDB
        await journey.saveToDB()

        if (action !== UPDATE_JOURNEY_SILENTLY) {
            await journey.draw({action: action})
        } else {
            journey.focus()
        }
        return journey
    }

    settings = () => {
        vt3d.mainProxy.components.journeyEditor.keys.journey.settings++
    }


}