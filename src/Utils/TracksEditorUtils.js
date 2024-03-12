import { TrackUtils } from './cesium/TrackUtils'

export class TracksEditorUtils {

    /**
     * We change its key to rerender the list component
     */
    static reRenderTracksList = () => {
        vt3d.mainProxy.components.tracksEditor.trackListKey++
    }

    static reRenderTrackSettings = () => {
        vt3d.mainProxy.components.tracksEditor.trackSettingsKey++
    }


    static prepareTrackEdition = (event) => {
        // SUbscribe to change  https://valtio.pmnd.rs/docs/api/advanced/subscribe
        if (isOK(event)) {
            vt3d.trackEditorProxy.track = vt3d.getTrackBySlug(event.target.value)
            TracksEditorUtils.reRenderTrackSettings()
            TrackUtils.focus(vt3d.trackEditorProxy.track)
        }
    }

}