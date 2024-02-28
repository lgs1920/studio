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

    const store = vt3d.mainProxy.components.tracksEditor
    const snap = useSnapshot(store)

    const setOpen = (open) => {
        store.show = open
    }

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
            store.show = false
        }
    }

    /**
     * Open tracks editor pane
     *
     * @param event
     */
    const openTracksEditor = (event) => {
        store.show = true
    }


    return (
        <>
            <div id="tracks-editor-container" key={snap.key}>

                {snap.visible && <SlDrawer id="tracks-editor-pane" open={snap.show}
                                           no-modal
                                           contained
                                           onSlRequestClose={handleRequestClose}
                                           onSlHide={closeTracksEditor}
                                           onSlShow={TrackUtils.prepareTrackEdition}>
                    <TrackSelector onChange={TracksEditorUtils.prepareTrackEdition}
                                   label={'Select a track:'}/>
                    <TrackSettings/>
                    <div id="tracks-editor-footer" slot={'footer'}>
                    </div>
                </SlDrawer>}
            </div>
            {/* <SlTooltip content="Edit Tracks"> */}
            {
                snap.visible &&
                <SlButton size="small" id={'open-currentTrack-editor'} onClick={openTracksEditor}>
                    <SlIcon library="fa" name={FA2SL.set(faPencil)}></SlIcon>
                </SlButton>
            }
            {/* </SlTooltip> */}
        </>)
})
