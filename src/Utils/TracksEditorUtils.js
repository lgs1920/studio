import { TrackUtils } from './cesium/TrackUtils'

export class TracksEditorUtils {

    static renderjourney

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

    static initJourneyEdition = (event) => {
        // SUbscribe to change  https://valtio.pmnd.rs/docs/api/advanced/subscribe

        if (isOK(event)) {
            vt3d.theJourneyEditorProxy.journey = vt3d.getJourneyBySlug(event.target.value)
            vt3d.theJourneyEditorProxy.journey.addToContext()
            // Force Track and POI in editor
            vt3d.theJourneyEditorProxy.track = null
            vt3d.theJourneyEditorProxy.poi = null
            // Force rerender
            TracksEditorUtils.renderJourneySettings()
            // Save information
            TrackUtils.saveCurrentJourneyToDB(event.target.value).then(
                async () => {
                    if (vt3d.theJourneyEditorProxy.journey.visible) {
                        vt3d.theJourney.focus()
                    }

                    await TrackUtils.saveCurrentTrackToDB(null)
                    await TrackUtils.saveCurrentPOIToDB(null)
                },
            )

        }
    }
    static initTrackEdition = (event) => {
        // SUbscribe to change  https://valtio.pmnd.rs/docs/api/advanced/subscribe

        if (isOK(event)) {
            vt3d.theJourneyEditorProxy.track = vt3d.getTrackBySlug(event.target.value)
            vt3d.theJourneyEditorProxy.track.addToContext()
            // Force POI in editor
            vt3d.theJourneyEditorProxy.poi = null

            // Force rerender
            TracksEditorUtils.renderJourneySettings()
            // Save information
            TrackUtils.saveCurrentTrackToDB(event.target.value).then(
                async () => {
                    if (vt3d.theJourneyEditorProxy.track.visible) {
                        vt3d.theJourneyEditorProxy.track.focus()
                    }

                    await TrackUtils.saveCurrentPOIToDB(null)
                },
            )

        }
    }

    settings = () => {
        vt3d.mainProxy.components.journeyEditor.keys.journey.settings++
    }

}