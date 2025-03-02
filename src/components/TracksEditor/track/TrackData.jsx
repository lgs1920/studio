/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackData.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit'
import {
    faArrowDownRight, faArrowUpRight, faClockDesk, faDownToLine, faGaugeSimpleHigh, faRoute, faUpToLine,
}                        from '@fortawesome/pro-regular-svg-icons'
import {
    faPause, faPersonHiking,
}                        from '@fortawesome/pro-solid-svg-icons'
import {
    SlCard, SlDivider,
}                        from '@shoelace-style/shoelace/dist/react'
import {
    TrackUtils,
}                        from '@Utils/cesium/TrackUtils'
import {
    FA2SL,
}                        from '@Utils/FA2SL'
import {
    DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS,
}                        from '@Utils/UnitUtils'

import { useSnapshot } from 'valtio'
import { DateInfo }    from '../DateInfo'

export const TrackData = function TrackData() {
    const editorStore = lgs.theJourneyEditorProxy

    // If we're editing a single track journey, we need
    // to know the track
    if (editorStore.track === null || editorStore.track === undefined) {
        (async () => await TrackUtils.setTheTrack(false))()
    }
    if (editorStore.track.metrics === undefined) {
        return
    }
    const editorSnapshot = useSnapshot(editorStore)

    const metrics = editorStore.track.metrics.global

    const trackDate = (!isNaN(metrics?.duration)) ? {
        start: editorStore.track.metrics.points[0].time,
        stop: editorStore.track.metrics.points[editorStore.track.metrics.points.length - 1].time,
    } : {}


    return (<>
        {metrics && <SlCard className={'element-data'}>

            {(!isNaN(metrics?.duration)) &&
                <DateInfo date={trackDate}/>
            }

            <div className={'element-row'}>

                <div className={'element-item title'}>Distance</div>
                <div className={'element-item'}>
                    <sl-icon variant="primary" library="fa"
                             name={FA2SL.set(faRoute)}></sl-icon>
                    <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS}/>
                </div>
            </div>
            <div className={'element-row'}>
                {metrics.positive &&
                    <>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                            <NameValueUnit value={metrics.positive.distance}
                                           units={DISTANCE_UNITS}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowDownRight)}></sl-icon>
                            <NameValueUnit value={metrics.negative.distance}
                                           units={DISTANCE_UNITS}/>
                        </div>
                    </>
                }
            </div>
            {!isNaN(metrics?.duration) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Duration</div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faClockDesk)}></sl-icon>
                            <NameValueUnit value={__.convert(metrics.duration).toTime()} id={'cursor-duration'}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <NameValueUnit value={__.convert(metrics.duration - metrics.idleTime).toTime()}
                                           id={'cursor-duration'}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPause)}></sl-icon>
                            <NameValueUnit value={__.convert(metrics.idleTime).toTime()} id={'cursor-duration'}/>
                        </div>
                    </div>
                </>
            }


            {metrics?.negative?.elevation < 0 && metrics?.positive?.elevation > 0 &&
                <>
                    <SlDivider style={{'--width': '1px'}}/>

                    <div className={'element-row'}>
                        <div className={'element-item title'}>Elevation</div>
                        {metrics.positive.elevation > 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS}
                                               format={'%\' .1f'}/>
                            </div>
                        }
                        {metrics.negative.elevation < 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa"
                                         name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                <NameValueUnit value={metrics.negative.elevation} units={ELEVATION_UNITS}
                                               format={'%\' .1f'}/>
                            </div>
                        }
                    </div>
                </>

            }

            {!isNaN(metrics?.minHeight) && !isNaN(metrics?.maxHeight) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Altitude</div>

                        {!isNaN(metrics.minHeight) && <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faDownToLine)}></sl-icon>
                            <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} format={'%\' .1f'}/>
                        </div>}
                        {!isNaN(metrics.maxHeight) && <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} format={'%\' .1f'}/>
                        </div>}

                    </div>
                </>
            }


            {!isNaN(metrics?.duration) &&
                <>
                    <SlDivider style={{'--width': '1px'}}/>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Speed</div>

                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faGaugeSimpleHigh)}></sl-icon>
                            <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faDownToLine)}></sl-icon>
                            <NameValueUnit value={metrics.minSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    {!isNaN(metrics?.minHeight) &&
                        <div className={'element-row'}>
                            {metrics.positive.elevation > 0 &&
                                <div className={'element-item indented'}>
                                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                    <NameValueUnit value={metrics.positive.speed} units={SPEED_UNITS}/>
                                </div>
                            }
                            {metrics.negative.elevation < 0 &&
                                <div className={'element-item'}>
                                    <sl-icon variant="primary" library="fa"
                                             name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                    <NameValueUnit value={metrics.negative.speed} units={SPEED_UNITS}/>
                                </div>
                            }
                        </div>
                    }

                </>
            }

            {!isNaN(metrics?.duration) &&
                <>
                    <SlDivider style={{'--width': '1px'}}/>

                    <div className={'element-row'}>
                        <div className={'element-item title'}>Pace</div>

                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faGaugeSimpleHigh)}></sl-icon>
                            <NameValueUnit value={metrics.averagePace} units={PACE_UNITS}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={PACE_UNITS}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faDownToLine)}></sl-icon>
                            <NameValueUnit value={metrics.minPace} units={PACE_UNITS}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <NameValueUnit value={metrics.maxPace} units={PACE_UNITS}/>
                        </div>
                    </div>
                    {!isNaN(metrics?.minHeight) &&
                        <div className={'element-row'}>
                            {metrics.positive.elevation > 0 &&
                                <div className={'element-item indented'}>
                                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                    <NameValueUnit value={metrics.positive.pace} units={PACE_UNITS}/>
                                </div>
                            }
                            {metrics.negative.elevation < 0 &&
                                <div className={'element-item'}>
                                    <sl-icon variant="primary" library="fa"
                                             name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                    <NameValueUnit value={metrics.negative.pace} units={PACE_UNITS}
                                                   format={'%\' .1f'}/>
                                </div>
                            }
                        </div>
                    }

                </>
            }

        </SlCard>}
    </>)

}
