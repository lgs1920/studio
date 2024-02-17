import './style.css'
import {faMapLocation}                             from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlIcon, SlIconButton, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                                from 'react'
import {Track}                                     from '../../../Classes/Track'
import {FA2SL}                                     from '../../../Utils/FA2SL'
import {TrackUtils as TU}                          from '../../../Utils/TrackUtils'
import {AltitudeChoice}                            from '../Modals/AltitudeChoice'

export const TrackFileLoaderUI = forwardRef(function TrackFileLoaderUI(props, ref) {
    const uploadFile = async () => {
        const track = await TU.loadTrackFromFile()
        // File is correct let's work with
        if (track !== undefined) {
            let currentTrack = new Track(track.name, track.extension, track.content)
            currentTrack.addToContext()
            await currentTrack.show()
        }
    }

    return (
        <>
            <div id="file-loader" className={'ui-element transparent'} ref={ref}>
                <SlTooltip content="Load a track file">
                    <SlButton size="small" onClick={uploadFile}>
                        <SlIcon library="fa" name={FA2SL.set(faMapLocation)} slot={'prefix'}/>
                    </SlButton>
                    <SlIconButton name="circle-check"
                                  target={'_blank'}
                                  href={'https://github.com/ViewTrack3D/vt3d'}
                    />
                </SlTooltip>
            </div>
            <AltitudeChoice/>
        </>
    )

})

