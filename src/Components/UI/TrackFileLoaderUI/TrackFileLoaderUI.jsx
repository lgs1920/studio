import './style.css'
import {library}                     from '@fortawesome/fontawesome-svg-core'
import {faMapLocation}               from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlIcon, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                  from 'react'
import {TrackUtils}                  from '../../../Utils/TrackUtils'
import {UIUtils as UI}               from '../../../Utils/UIUtils'

library.add(faMapLocation)

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
                    <SlIcon src={UI.faIconName(faMapLocation)} slot={'prefix'}/>
                </SlButton>
            </SlTooltip>
        </div>
    )

})

