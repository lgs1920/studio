import {faChevronDown}              from '@fortawesome/pro-regular-svg-icons'
import {SlIcon, SlOption, SlSelect} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                 from 'react'
import {useSnapshot}                from 'valtio'
import {FA2SL}                      from '../../../Utils/FA2SL'

export const TrackSelector = forwardRef(function TrackSelector(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }

    const store = window.vt3d.store.components.tracksEditor
    const snap = useSnapshot(store)

    let tracks = []
    snap.list.forEach(slug => {
        tracks.push(vt3d.getTrackBySlug(slug))
    })

    console.log(tracks)

    return (
        <>
            <SlSelect hoist label={props.label} value={window.vt3d.context.currentTrack} /*onSlChange={props.onChange}*/
                      onSlSelect={handleRequestClose}>
                <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

                {tracks.map(track =>
                    <SlOption key={track.slug} value={track.slug}>{track.name}</SlOption>,
                )}
            </SlSelect>
        </>
    )
})