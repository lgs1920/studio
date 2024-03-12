import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect }       from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                       from 'react'
import { useSnapshot }                      from 'valtio'
import { FA2SL }                            from '../../../Utils/FA2SL'

export const TrackSelector = forwardRef(function TrackSelector(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }
    const mainStore = vt3d.mainProxy.components.tracksEditor
    const mainSnap = useSnapshot(mainStore)
    const editorStore = vt3d.trackEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    const several = mainSnap.list.length > 1

    /**
     * Get tracks from the snap that contains only slugs
     */
    let tracks = []
    mainSnap.list.forEach(slug => {
        tracks.push(vt3d.getTrackBySlug(slug))
    })

    /**
     * Sort the list
     *
     * //TODO other criterias
     */
    if (several) {
        // sort list alphabetically
        tracks.sort(function (a, b) {
            if (a.title < b.title) {
                return 1
            }
            if (a.title > b.title) {
                return -1
            }
            return 0
        })
    }

    // set Default
    mainStore.currentTrack = vt3d.currentTrack?.slug


    return (
        <>
            {
                several &&
                <SlSelect hoist label={props.label}
                          value={editorSnapshot.track.slug}
                          onSlChange={props.onChange}
                          key={mainSnap.trackListKey}
                >
                    <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

                    {tracks.map(track =>
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