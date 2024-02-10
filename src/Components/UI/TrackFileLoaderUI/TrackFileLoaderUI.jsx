import './style.css'
import {faMapLocation}                             from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlIcon, SlIconButton, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                                from 'react'
import {FA2SL}                                     from '../../../Utils/FA2SL'
import {TrackUtils}                                from '../../../Utils/TrackUtils'

export const TrackFileLoaderUI = forwardRef(function TrackFileLoaderUI(props, ref) {
    const uploadFile = async () => {
        const file = await TrackUtils.loadTrack()
        // File is correct, we save it in context
        if (file !== undefined) {
            window.vt3d.addTrack(file)
            TrackUtils.showTrack(file)
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

