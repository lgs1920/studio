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
        if (isOK(event)) {
            const editorStore = vt3d.theJourneyEditorProxy
            editorStore.journey = vt3d.getJourneyBySlug(event.target.value)
            editorStore.journey.addToContext()
            // Force Track and POI in editor
            if (editorStore.track === null || editorStore.track === undefined) {
                editorStore.track = Array.from(editorStore.journey.tracks)[0]
                editorStore.track.addToContext()
                editorStore.track.addToEditor()
            }
            editorStore.poi = null
            // Force rerender
            TracksEditorUtils.renderJourneysList()
            TracksEditorUtils.renderJourneySettings()
            TracksEditorUtils.renderTracksList()
            TracksEditorUtils.renderTrackSettings()


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
        console.log(isOK(event))

        if (isOK(event)) {
            const editorStore = vt3d.theJourneyEditorProxy
            editorStore.track = vt3d.getTrackBySlug(event.target.value)
            editorStore.track.addToContext()
            editorStore.track.addToEditor()
            // Force POI in editor
            editorStore.poi = null

            // Force rerender
            TracksEditorUtils.renderTracksList()
            TracksEditorUtils.renderTrackSettings()
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

    settings = () => {
        vt3d.mainProxy.components.journeyEditor.keys.journey.settings++
    }

}