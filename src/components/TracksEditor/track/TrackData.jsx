import { TextValueUI } from '@Components/TextValueUI/TextValueUI'
import {
    faArrowDownRight, faArrowUpRight, faClockDesk, faDownToLine, faGaugeSimpleHigh, faRoute, faUpToLine,
}                      from '@fortawesome/pro-regular-svg-icons'
import {
    faPause, faPersonHiking,
}                      from '@fortawesome/pro-solid-svg-icons'
import {
    SlCard, SlDivider,
}                      from '@shoelace-style/shoelace/dist/react'
import {
    TrackUtils,
}                      from '@Utils/cesium/TrackUtils'
import {
    FA2SL,
}                      from '@Utils/FA2SL'

import { useSnapshot }                                  from 'valtio'
import { foot, km, kmh, meter, mile, mkm, mph, mpmile } from '../../../Utils/UnitUtils'

export const TrackData = function TrackData() {
    const editorStore = vt3d.theJourneyEditorProxy

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

    return (<>
        {metrics && <SlCard className={'element-data'}>
            <div className={'element-row'}>

                <div className={'element-item title'}>Distance</div>
                <div className={'element-item'}>
                    <sl-icon variant="primary" library="fa"
                             name={FA2SL.set(faRoute)}></sl-icon>
                    <TextValueUI value={metrics.distance} units={[km, mile]}/>
                </div>
            </div>
            <div className={'element-row'}>
                {metrics.positive &&
                    <>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                            <TextValueUI value={metrics.positive.distance}
                                         units={[km, mile]}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowDownRight)}></sl-icon>
                            <TextValueUI value={metrics.negative.distance}
                                         units={[km, mile]}/>
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
                            <TextValueUI value={__.convert(metrics.duration).toTime()} id={'cursor-duration'}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <TextValueUI value={__.convert(metrics.duration - metrics.idleTime).toTime()}
                                         id={'cursor-duration'}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPause)}></sl-icon>
                            <TextValueUI value={__.convert(metrics.idleTime).toTime()} id={'cursor-duration'}/>
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
                                <TextValueUI value={metrics.positive.elevation} units={[meter, foot]}
                                             format={'%\' .1f'}/>
                            </div>
                        }
                        {metrics.negative.elevation < 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa"
                                         name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                <TextValueUI value={metrics.negative.elevation} units={[meter, foot]}
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
                            <TextValueUI value={metrics.minHeight} units={[meter, foot]} format={'%\' .1f'}/>
                        </div>}
                        {!isNaN(metrics.maxHeight) && <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <TextValueUI value={metrics.maxHeight} units={[meter, foot]} format={'%\' .1f'}/>
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
                            <TextValueUI value={metrics.averageSpeed} units={[kmh, mph]}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <TextValueUI value={metrics.averageSpeedMoving} units={[kmh, mph]}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faDownToLine)}></sl-icon>
                            <TextValueUI value={metrics.minSpeed} units={[kmh, mph]}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <TextValueUI value={metrics.maxSpeed} units={[kmh, mph]}/>
                        </div>
                    </div>
                    {!isNaN(metrics?.minHeight) &&
                        <div className={'element-row'}>
                            {metrics.positive.elevation > 0 &&
                                <div className={'element-item indented'}>
                                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                    <TextValueUI value={metrics.positive.speed} units={[kmh, mph]}/>
                                </div>
                            }
                            {metrics.negative.elevation < 0 &&
                                <div className={'element-item'}>
                                    <sl-icon variant="primary" library="fa"
                                             name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                    <TextValueUI value={metrics.negative.speed} units={[kmh, mph]}/>
                                </div>
                            }
                        </div>
                    }

                </>
            }

            {!isNaN(metrics?.duration) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Pace</div>

                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faGaugeSimpleHigh)}></sl-icon>
                            <TextValueUI value={metrics.averagePace} units={[mkm, mpmile]}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <TextValueUI value={metrics.averageSpeedMoving} units={[mkm, mpmile]}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faDownToLine)}></sl-icon>
                            <TextValueUI value={metrics.minPace} units={[mkm, mpmile]}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <TextValueUI value={metrics.maxPace} units={[mkm, mpmile]}/>
                        </div>
                    </div>
                    {!isNaN(metrics?.minHeight) &&
                        <div className={'element-row'}>
                            {metrics.positive.elevation > 0 &&
                                <div className={'element-item indented'}>
                                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                    <TextValueUI value={metrics.positive.pace} units={[mkm, mpmile]}/>
                                </div>
                            }
                            {metrics.negative.elevation < 0 &&
                                <div className={'element-item'}>
                                    <sl-icon variant="primary" library="fa"
                                             name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                    <TextValueUI value={metrics.negative.pace} units={[mkm, mpmile]}
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
