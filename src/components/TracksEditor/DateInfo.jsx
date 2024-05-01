import { faLocationPin }     from '@fortawesome/pro-solid-svg-icons'
import { SlDivider, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import { DateTime }          from 'luxon'

export const DateInfo = function DateInfo(props) {

    const data = props.date
    const date = {
        start: {
            date: DateTime.fromISO(data.start).toLocaleString(DateTime.DATE_FULL),
            time: DateTime.fromISO(data.start).toLocaleString(DateTime.TIME_SIMPLE),
        },
        stop: {
            date: DateTime.fromISO(data.stop).toLocaleString(DateTime.DATE_FULL),
            time: DateTime.fromISO(data.stop).toLocaleString(DateTime.TIME_SIMPLE),
        },
    }
    const sameDay = date.start.date === date.stop.date
    return (<>
        {sameDay &&
            <div className={'track-date'}>
                <span>{date.start.date}</span>
                <span>
                    <SlIcon library="fa" name={FA2SL.set(faLocationPin)}
                            style={{color: vt3d.configuration.journey.pois.start.color}}/>
                    {date.start.time}
                </span>
                <span>
                    <SlIcon library="fa" name={FA2SL.set(faLocationPin)}
                            style={{color: vt3d.configuration.journey.pois.stop.color}}/>
                    {date.stop.time}
                </span>
            </div>

        }

        {!sameDay &&
            <div className={'track-date'}>
                <span>
                <SlIcon library="fa" name={FA2SL.set(faLocationPin)}
                        style={{color: vt3d.configuration.journey.pois.start.color}}/>
                    {date.start.date} {date.start.time}
                </span>
                <span>
                <SlIcon library="fa" name={FA2SL.set(faLocationPin)}
                        style={{color: vt3d.configuration.journey.pois.stop.color}}/>
                    {date.stop.date} {date.stop.time}
                </span>
            </div>
        }
        <SlDivider style={{'--width': '1px'}}/>
    </>)
}
