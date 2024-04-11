import { CURRENT_JOURNEY, CURRENT_STORE } from '../classes/VT3D'

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

    static setJourneyEdition = (event) => {
        // SUbscribe to change  https://valtio.pmnd.rs/docs/api/advanced/subscribe
        if (isOK(event)) {

            vt3d.theJourneyEditorProxy.journey = vt3d.getJourneyBySlug(event.target.value)
            vt3d.theJourneyEditorProxy.journey.addToContext()
            TracksEditorUtils.renderJourneySettings()
            vt3d.db.journeys.put(CURRENT_JOURNEY, event.target.value, CURRENT_STORE).then(
                () => {
                    if (vt3d.theJourneyEditorProxy.journey.visible) {
                        vt3d.theJourney.focus()
                    }
                },
            )
        }
    }

    settings = () => {
        vt3d.mainProxy.components.journeyEditor.keys.journey.settings++
    }

}