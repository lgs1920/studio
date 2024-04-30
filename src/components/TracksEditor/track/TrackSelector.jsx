import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'
import { forwardRef }                       from 'react'
import { useSnapshot }                      from 'valtio'

export const TrackSelector = forwardRef(function TrackSelector(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }
    const mainStore = vt3d.mainProxy.components.journeyEditor
    const mainSnapshot = useSnapshot(mainStore)
    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)
    const tracks = editorStore.journey.tracks

    if (editorStore.track === null || editorStore.track === undefined) {
        editorStore.track = Array.from(tracks.values())[0]
    }
    // if (tracks.size > 1) {
    // We do not sort the list
    // TODO : Check if it right to take tracks in the order in which they were created.
    // }

    return (<>
            { // Several tracks : we add a selection widget
                tracks.size > 1 && <SlSelect hoist label={props.label}
                                             value={editorSnapshot.track.slug}
                                             onSlChange={props.onChange}
                                             key={mainSnapshot.keys.track.list}
                >
                    <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>
                    {Array.from(editorSnapshot.journey.tracks.values()).map(track =>
                        <SlOption key={track.title} value={track.slug}>
                            {track.visible ? <SlIcon slot="suffix" library="fa" name={FA2SL.set(faEye)}/> : <SlIcon
                                slot="suffix" library="fa" name={FA2SL.set(faEyeSlash)}/>}
                            {track.title}
                        </SlOption>)}
                </SlSelect>}
        </>

    )
})