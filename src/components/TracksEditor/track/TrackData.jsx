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
    DAY, HOUR,
}                      from '@Utils/AppUtils'
import {
    TrackUtils,
}                      from '@Utils/cesium/TrackUtils'
import {
    FA2SL,
}                      from '@Utils/FA2SL'
import {
    Duration,
}                      from 'luxon'
import {
    useSnapshot,
}                      from 'valtio'
import {
    km, kmh, mkm,
}                      from '../../../Utils/UnitUtils'

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

    const format = (data) => {
        const duration = data ? Duration.fromObject({seconds: data}) : undefined
        if (duration) {
            return duration.toFormat((data >= DAY / 1000 ? `dd \'day\' ` : '') + (data >= HOUR / 1000 ? 'hh\'h\'' : '') + 'mm\'m\'')
        }
        return ''
    }

    return (<>
        {metrics && <SlCard className={'element-data'}>
            <div className={'element-row'}>

                <div className={'element-item title'}>Distance</div>
                <div className={'element-item'}>
                    <sl-icon variant="primary" library="fa"
                             name={FA2SL.set(faRoute)}></sl-icon>
                    <TextValueUI value={sprintf('%\' .2f', metrics.distance / 1000)}
                                 unit={km}/>
                </div>
            </div>
            <div className={'element-row'}>

                {metrics.positive &&
                    <>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                            <TextValueUI value={sprintf('%\' .2f', metrics.positive.distance / 1000)}
                                         unit={km}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowDownRight)}></sl-icon>
                            <TextValueUI value={sprintf('%\' .2f', metrics.negative.distance / 1000)}
                                         unit={km}/>
                        </div>
                    </>
                }
            </div>
            {!isNaN(metrics.duration) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Duration</div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faClockDesk)}></sl-icon>
                            <TextValueUI value={format(metrics.duration)} id={'cursor-duration'}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <TextValueUI value={format(metrics.duration - metrics.idleTime)}
                                         id={'cursor-duration'}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPause)}></sl-icon>
                            <TextValueUI value={format(metrics.idleTime)} id={'cursor-duration'}/>
                        </div>
                    </div>
                </>
            }

            <SlDivider style={{'--width': '1px'}}/>

            {metrics?.negative.elevation < 0 && metrics?.positive.elevation > 0 &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Elevation</div>
                        {metrics.positive.elevation > 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                <TextValueUI value={sprintf('%\' .1f', metrics.positive.elevation)} unit={'m'}/>
                            </div>
                        }
                        {metrics.negative.elevation < 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa"
                                         name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                <TextValueUI value={sprintf('%\' .1f', metrics.negative.elevation)} unit={'m'}/>
                            </div>
                        }
                    </div>
                </>

            }

            {!isNaN(metrics.minHeight) && !isNaN(metrics.maxHeight) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Altitude</div>

                        {!isNaN(metrics.minHeight) && <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faDownToLine)}></sl-icon>
                            <TextValueUI value={metrics.minHeight} unit={'m'}/>
                        </div>}
                        {!isNaN(metrics.maxHeight) && <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <TextValueUI value={metrics.maxHeight} unit={'m'}/>>
                        </div>}

                    </div>
                </>
            }

            <SlDivider style={{'--width': '1px'}}/>

            {!isNaN(metrics?.duration) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Speed</div>

                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faGaugeSimpleHigh)}></sl-icon>
                            <TextValueUI value={metrics.averageSpeed} unit={kmh}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <TextValueUI value={metrics.maxHeight} unit={kmh}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <TextValueUI value={metrics.maxSpeed} unit={kmh}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        {metrics.positive.elevation > 0 &&
                            <div className={'element-item indented'}>
                                <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                <TextValueUI value={sprintf('%\' .1f', metrics.positive.elevation)} unit={kmh}/>
                            </div>
                        }
                        {metrics.negative.elevation < 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa"
                                         name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                <TextValueUI value={sprintf('%\' .1f', metrics.negative.elevation)} unit={kmh}/>
                            </div>
                        }
                    </div>

                </>
            }

            {!isNaN(metrics?.duration) &&
                <>
                    <div className={'element-row'}>
                        <div className={'element-item title'}>Pace</div>

                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faGaugeSimpleHigh)}></sl-icon>
                            <TextValueUI value={metrics.averagePace} unit={mkm}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        <div className={'element-item indented'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faPersonHiking)}></sl-icon>
                            <TextValueUI value={metrics.maxHeight} unit={mkm}/>
                        </div>
                        <div className={'element-item'}>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faUpToLine)}></sl-icon>
                            <TextValueUI value={metrics.maxPace} unit={mkm}/>
                        </div>
                    </div>
                    <div className={'element-row'}>
                        {metrics.positive.elevation > 0 &&
                            <div className={'element-item indented'}>
                                <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowUpRight)}></sl-icon>
                                <TextValueUI value={sprintf('%\' .1f', metrics.positive.elevation)} unit={mkm}/>
                            </div>
                        }
                        {metrics.negative.elevation < 0 &&
                            <div className={'element-item'}>
                                <sl-icon variant="primary" library="fa"
                                         name={FA2SL.set(faArrowDownRight)}></sl-icon>
                                <TextValueUI value={sprintf('%\' .1f', metrics.negative.elevation)} unit={mkm}/>
                            </div>
                        }
                    </div>

                </>
            }

        </SlCard>}
    </>)

}
