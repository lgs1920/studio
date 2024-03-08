import { faPencil }                   from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                 from 'react'
import { useSnapshot }                from 'valtio'
import { TrackUtils }                 from '../../../Utils/cesium/TrackUtils'
import { FA2SL }                      from '../../../Utils/FA2SL'
import './style.css'
import { TracksEditorUtils }          from '../../../Utils/TracksEditorUtils'
import { TrackSelector }              from './TrackSelector'
import { TrackSettings }              from './TrackSettings'

//read version


export const TracksEditor = forwardRef(function TracksEditor(props, ref) {

    const mainStore = vt3d.mainProxy.components.tracksEditor
    const mainSnap = useSnapshot(mainStore)

    const editorStore = vt3d.editorProxy
    const editorSnap = useSnapshot(editorStore)

    /**
     * Avoid click outside drawer
     */
    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }
    /**
     * Close tracks editor pane
     *
     * @param event
     */
    const closeTracksEditor = (event) => {
        if (isOK(event)) {
            mainStore.show = false
        }
    }

    /**
     * Open tracks editor pane
     *
     * @param event
     */
    const toggleTracksEditor = (event) => {
        mainStore.show = !mainStore.show
    }

    return (<>
        <div id="tracks-editor-container" key={mainSnap.key}>
            {mainSnap.usable && <SlDrawer id="tracks-editor-pane" open={mainSnap.show}
                                          no-modal
                                          contained
                                          onSlRequestClose={handleRequestClose}
                                          onSlHide={closeTracksEditor}
                                          onSlShow={TrackUtils.prepareTrackEdition}>
                {vt3d.tracks.length > 0 && <>
                    <TrackSelector onChange={TracksEditorUtils.prepareTrackEdition}
                                   label={'Select a track:'}/>
                    <TrackSettings/>
                </>}
                <div id="tracks-editor-footer" slot={'footer'}></div>
            </SlDrawer>}
        </div>
        {/* <SlTooltip content="Edit Tracks"> */}
        {mainSnap.usable && <SlButton size={'small'} className={'square-icon'} id={'open-currentTrack-editor'}
                                      onClick={toggleTracksEditor}>
            <SlIcon library="fa" name={FA2SL.set(faPencil)}></SlIcon>
        </SlButton>}
        {/* </SlTooltip> */}
    </>)
})
