import './style.css'
import {library}             from '@fortawesome/fontawesome-svg-core'
import {faMapLocation}       from '@fortawesome/pro-regular-svg-icons'
import {FontAwesomeIcon}     from '@fortawesome/react-fontawesome'
import {SlButton, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}          from 'react'
import {TrackUtils}          from '../../../Utils/TrackUtils'


library.add(faMapLocation)

export const TrackFileLoaderUI = forwardRef(function TrackFileLoaderUI(props, ref) {
    const uploadFile = async () => {
        const file = await TrackUtils.loadTrack()
        // File is correct, we save it in context
        if (file !== undefined) {
            window.vt3DContext.addTrack(file)
            TrackUtils.showTrack(file)
        }
    }

    return (
        <div id="file-loader" className={'ui-element transparent'} ref={ref}>
            <SlTooltip content="Load a track file">
                <SlButton size="small" onClick={uploadFile}><FontAwesomeIcon icon={faMapLocation}
                                                                             slot={'prefix'}/></SlButton>
            </SlTooltip>
        </div>
    )

})

