import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect }       from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                       from 'react'
import { useSnapshot }                      from 'valtio'
import { FA2SL }                            from '../../../Utils/FA2SL'

export const TrackSelector = forwardRef(function TrackSelector(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }
    const mainStore = vt3d.mainProxy.components.journeyEditor
    const mainSnapshot = useSnapshot(mainStore)
    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    const tracks = vt3d.theJourney.tracks
    const several = tracks.size > 1

    // if (several) {
    // We do not sort the list
    // TODO : Check if it right to take tracks in the order in which they were created.
    // }
    
    return (
        <>
            {
                several &&
                <SlSelect hoist label={props.label}
                          value={editorSnapshot.track ?? Array.from(tracks.values())[0].slug}
                          onSlChange={props.onChange}
                          key={mainSnapshot.keys.track.list}
                >
                    <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>
                    {Array.from(tracks.values()).map(track =>
                        <SlOption key={track.title} value={track.slug}>
                            {track.visible
                             ? <SlIcon slot="suffix" library="fa" name={FA2SL.set(faEye)}/>
                             : <SlIcon slot="suffix" library="fa" name={FA2SL.set(faEyeSlash)}/>
                            }
                            {track.title}
                        </SlOption>,
                    )}
                </SlSelect>
            }
        </>
    )
})