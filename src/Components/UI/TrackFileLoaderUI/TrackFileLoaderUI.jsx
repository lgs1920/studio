import './style.css'
import {faMapLocation}               from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlIcon, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                  from 'react'
import {useSnapshot}                 from 'valtio'
import {Track}                       from '../../../classes/Track'
import {FA2SL}                       from '../../../Utils/FA2SL'
import {TrackUtils}                  from '../../../Utils/TrackUtils'
import {UINotifier}                  from '../../../Utils/UINotifier'

export const TrackFileLoaderUI = forwardRef(function TrackFileLoaderUI(props, ref) {

    const store = vt3d.mainProxy
    const snap = useSnapshot(store)

    const uploadFile = async () => {
        const track = await TrackUtils.loadTrackFromFile()
        // File is correct let's work with
        if (track !== undefined) {
            let currentTrack = new Track(track.name, track.extension, {content: track.content})
            // Check if the track already exists in context
            // If not we manage and show it.
            if (vt3d.getTrackBySlug(currentTrack.slug)?.slug === undefined) {
                currentTrack.checkDataConsistency()
                if (!currentTrack.hasHeight) {
                    store.modals.altitudeChoice.show = true
                }
                currentTrack.addToContext()
                vt3d.addToEditor(currentTrack)
                await currentTrack.show()
            } else {
                // It exists, we notify it
                UINotifier.notifyWarning({
                    caption: `This track has already been loaded!`,
                    text: 'You can load another one !',
                })
            }
        }
    }

    return (
        <>
            <div id="file-loader" className={'ui-element transparent'} ref={ref}>
                <SlTooltip content="Load a track file">
                    <SlButton size="small" onClick={uploadFile}>
                        <SlIcon library="fa" name={FA2SL.set(faMapLocation)} slot={'prefix'}/>
                    </SlButton>
                </SlTooltip>
            </div>
        </>
    )

})

