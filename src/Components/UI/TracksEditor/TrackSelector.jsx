import {faChevronDown}              from '@fortawesome/pro-regular-svg-icons'
import {SlIcon, SlOption, SlSelect} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                 from 'react'
import {useSnapshot}                from 'valtio'
import {FA2SL}                      from '../../../Utils/FA2SL'

export const TrackSelector = forwardRef(function TrackSelector(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }
    const store = vt3d.mainProxy.components.tracksEditor
    const snap = useSnapshot(store)
    const snapEditor = useSnapshot(vt3d.editorProxy)

    const several = snap.list.length > 1

    /**
     * Get tracks from the snap that contains only slugs
     */
    let tracks = []
    snap.list.forEach(slug => {
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
    store.currentTrack = vt3d.currentTrack?.slug
    
    return (
        <>
            {
                several &&
                <SlSelect hoist label={props.label}
                          value={snapEditor.track.slug}
                          onSlChange={props.onChange}
                          key={snap.trackListKey}
                >
                    <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

                    {tracks.map(track =>
                        <SlOption key={track.slug} value={track.slug}>{track.title}</SlOption>,
                    )}
                </SlSelect>
            }
        </>
    )
})