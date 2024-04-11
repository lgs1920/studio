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

    const several = mainSnapshot.list.length > 1

    /**
     * Get tracks from the snap that contains only slugs
     */
    let tracks = []
    mainSnapshot.list.forEach(slug => {
        tracks.push(vt3d.getJourneyBySlug(slug))
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
    mainStore.theJourney = vt3d.theJourney?.slug


    return (
        <>
            {
                several &&
                <SlSelect hoist label={props.label}
                          value={editorSnapshot.journey.slug}
                          onSlChange={props.onChange}
                          key={mainSnapshot.keys.track.list}
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