import { faTriangleExclamation } from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'

export const TrackPoints = function TrackPoints() {
    return (<div className="track-points">
        <SlAlert variant="warning" open>
            <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
            <strong>Not Yet!</strong><br/>
            In a future version, it will be possible<br/>to view and edit points.
        </SlAlert>
    </div>)
}