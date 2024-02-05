import './style.css'
import {forwardRef}          from 'react'
import {FontAwesomeIcon}     from '@fortawesome/react-fontawesome'
import {faMapLocation}       from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {TrackUtils}          from '../../../Utils/TrackUtils'
import {UINotifier}          from '../../../Utils/UINotifier'
import { library, dom } from '@fortawesome/fontawesome-svg-core'
import { findIconDefinition, icon } from '@fortawesome/fontawesome-svg-core'


library.add(faMapLocation)
console.log(icon(faMapLocation).html)

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

