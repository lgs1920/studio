import { TextValueUI } from '@Components/TextValueUI/TextValueUI'
import { DAY, HOUR }   from '@Utils/AppUtils'
import { useSnapshot } from 'valtio'


export const TrackData = function TrackData() {
    return (<></>)
    const editorStore = vt3d.theJourneyEditorProxy

    // If we're editing a single track journey, we need
    // to know the track
    if (editorStore.track === null || editorStore.track === undefined) {
        (async () => await TrackUtils.setTheTrack(false))()
    }
    const editorSnapshot = useSnapshot(editorStore)

    const metrics = editorStore.track.metrics[0].global

    const duration = metrics.duration ? Duration.fromObject({seconds: metrics.duration}) : undefined
    const format = () => {
        let fmt = metrics.duration >= DAY / 1000
                  ? `dd \day} ` : ''
        fmt += metrics.duration >= HOUR / 1000 ? 'hh:' : ''
        fmt += 'mm'
        return fmt
    }

    return (<>
        {metrics && <>
            <div className={'floating-menu-data one-line'}>
                <sl-icon variant="primary" library="fa" name={FA2SL.set(faRulerHorizontal)}></sl-icon>
                <div>
                    <TextValueUI value={sprintf('%\' .2f', metrics.distance / 1000)} //TODO units KM or ...
                        // text={'Distance:'}
                                 id={'cursor-distance'}
                                 unit={'kms'}/>
                </div>
            </div>
            {!isNaN(metrics.duration) &&
                <div className={'floating-menu-data one-line'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faStopwatch)}></sl-icon>
                    <div>
                        <TextValueUI value={duration.toFormat(format())}
                                     id={'cursor-duration'}/>
                    </div>
                </div>
            }

            {!isNaN(metrics.minHeight) && !isNaN(metrics.maxHeight) &&
                <div className={'floating-menu-title'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                    Altitude
                </div>
            }

            {!isNaN(metrics.minHeight) &&
                <div className={'floating-menu-data'}>
                    <div>
                        <TextValueUI value={metrics.minHeight}
                                     text={'min.'}
                                     unit={'m'}
                        />
                    </div>
                </div>
            }
            {!isNaN(metrics.maxHeight) &&
                <div className={'floating-menu-data'}>
                    <div>
                        <TextValueUI value={metrics.maxHeight}
                                     text={'max.'}
                                     unit={'m'}
                        />
                    </div>
                </div>
            }

            {metrics.negativeElevation < 0 && metrics.positiveElevation > 0 &&
                <div className={'floating-menu-title'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowTrendUp)}></sl-icon>
                    Elevation
                </div>
            }
            {metrics.positiveElevation > 0 &&
                <div className={'floating-menu-data'}>
                    <div>
                        <TextValueUI value={sprintf('%\' .1f', metrics.positiveElevation)}
                                     text={'Gain'}
                                     unit={'m'}
                        />
                    </div>
                </div>
            }
            {metrics.negativeElevation < 0 &&
                <div className={'floating-menu-data'}>
                    <div>
                        <TextValueUI value={sprintf('%\' .1f', metrics.negativeElevation)}
                                     text={'Loss'}
                                     unit={'m'}
                        />
                    </div>
                </div>
            }

        </>}
    </>)

}
