import { faPencil }                              from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import './style.css'
import { forwardRef }                            from 'react'
import { useSnapshot }                           from 'valtio'
import { JourneySelector }                       from './journey/JourneySelector'
import { JourneySettings }                       from './journey/JourneySettings'
import { TrackSelector }                         from './track/TrackSelector'
import { TrackSettings }                         from './track/TrackSettings'
import { Utils }                                 from './Utils'

//read version


export const TracksEditor = forwardRef(function TracksEditor(props, ref) {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

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
            mainStore.components.journeyEditor.show = false
        }
    }

    /**
     * Open tracks editor pane
     *
     * @param event
     */
    const toggleTracksEditor = (event) => {
        mainStore.components.journeyEditor.show = !mainStore.components.journeyEditor.show
    }

    return (<>
        <div id="journeys-editor-container" key={mainSnap.components.journeyEditor.key}>
            {mainSnap.canViewJourneyData &&
                <SlDrawer id="journeys-editor-pane" open={mainSnap.components.journeyEditor.show}
                          onSlRequestClose={handleRequestClose}
                          contained
                          onSlHide={closeTracksEditor}
                >
                    {vt3d.journeys.size > 0 && <div id={'track-settings-container'}>
                        <JourneySelector onChange={Utils.initJourneyEdition}
                                         label={'Select a Journey:'}/>
                        <JourneySettings/>

                        {editorSnapshot.journey.visible && <>
                            <TrackSelector onChange={Utils.initTrackEdition}
                                           label={'Select one of the tracks:'}/>
                            <TrackSettings/>
                        </>}
                    </div>}
                    <div id="journeys-editor-footer" slot={'footer'}></div>
                </SlDrawer>}
        </div>

        <SlTooltip placement={'right'} content="Edit Tracks">
            {mainSnap.canViewJourneyData &&
                <SlButton size={'small'} className={'square-icon'} id={'open-theJourney-editor'}
                          onClick={toggleTracksEditor}>
                    <SlIcon library="fa" name={FA2SL.set(faPencil)}></SlIcon>
                </SlButton>}
        </SlTooltip>
    </>)
})
