import {faPencil}                   from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlDrawer, SlIcon} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                 from 'react'
import {useSnapshot}                from 'valtio'
import {FA2SL}                      from '../../../Utils/FA2SL'
import './style.css'
import {DEMServerSelection}         from '../TrackFileLoaderUI/DEMServerSelection'
import {TrackSelector}              from './TrackSelector'

//read version


export const TracksEditor = forwardRef(function TracksEditor() {

    const store = window.vt3d.store.components.tracksEditor
    const snap = useSnapshot(store)

    const setOpen = (open) => {
        store.show = open
    }

    return (<>

        <SlDrawer id="tracks-editor-pane" open={snap.show}
                  onSlAfterHide={() => setOpen(false)}>
            <TrackSelector/>
            <DEMServerSelection/>
            <div id="tracks-editor-footer" slot={'footer'}>
            </div>
        </SlDrawer>

        {/* <SlTooltip content="Edit Tracks"> */}
        {snap.visible && <SlButton size="small" id={'open-track-editor'} onClick={() => setOpen(true)}>
            <SlIcon library="fa" name={FA2SL.set(faPencil)}></SlIcon>
        </SlButton>}
        {/* </SlTooltip> */}

    </>)
})
