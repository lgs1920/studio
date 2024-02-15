import './style.css'
import {faMapLocation}                             from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlIcon, SlIconButton, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                                from 'react'
import {FA2SL}                                     from '../../../Utils/FA2SL'
import {TrackUtils}                                from '../../../Utils/TrackUtils'

export const TrackFileLoaderUI = forwardRef(function TrackFileLoaderUI(props, ref) {
    const uploadFile = async () => {
        const track = await TrackUtils.loadTrackFromFile()
        // File is correct let's work with
        if (track !== undefined) {
            // Let extratct GeoJson
            const geoJson = TrackUtils.trackToGeoJson(track)
            // May be we have some changes to operate
            const newGeoJson = await TrackUtils.prepareGeoJson(geoJson)
            // Get metrics
            const metrics = await TrackUtils.getMetrics(newGeoJson)

            // Let's add information to context
            window.vt3d.addTrack({
                content: newGeoJson,
                name: track.name,
                type: track.extension,
                metrics: metrics,
            })

            // All's fine, the show continues :!
            await TrackUtils.showTrack(newGeoJson)
        }
    }

    return (
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
    )

})

