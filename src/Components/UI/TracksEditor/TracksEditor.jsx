import { faPencil }                              from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                            from 'react'
import { useSnapshot }                           from 'valtio'
import { FA2SL }                                 from '../../../Utils/FA2SL'
import './style.css'
import { TracksEditorUtils }                     from '../../../Utils/TracksEditorUtils'
import { TrackSelector }                         from './TrackSelector'
import { TrackSettings }                         from './TrackSettings'

//read version


export const TracksEditor = forwardRef(function TracksEditor(props, ref) {

    const mainStore = vt3d.mainProxy.components.journeyEditor
    const mainSnap = useSnapshot(mainStore)

    const editorStore = vt3d.theJourneyEditorProxy
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
        <div id="journeys-editor-container" key={mainSnap.key}>
            {mainSnap.usable &&
                <SlDrawer id="journeys-editor-pane" open={mainSnap.show}
                          onSlRequestClose={handleRequestClose}
                          contained
                          onSlHide={closeTracksEditor}
                    // onSlShow={TracksEditorUtils.prepareTrackEdition}
                >
                    {vt3d.journeys.size > 0 && <div id={'track-settings-container'}>
                        <TrackSelector onChange={TracksEditorUtils.prepareTrackEdition}
                                       label={'Select a track:'}/>
                        <TrackSettings/>
                    </div>}
                    <div id="journeys-editor-footer" slot={'footer'}></div>
                </SlDrawer>}
        </div>

        <SlTooltip placement={'right'} content="Edit Tracks">
            {mainSnap.usable && <SlButton size={'small'} className={'square-icon'} id={'open-theJourney-editor'}
                                          onClick={toggleTracksEditor}>
                <SlIcon library="fa" name={FA2SL.set(faPencil)}></SlIcon>
            </SlButton>}
        </SlTooltip>
    </>)
})
