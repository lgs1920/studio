/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackData.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: TrackData.jsx
 ******************************************************************************/

import { NameValueUnit }                                            from '@Components/DataDisplay/NameValueUnit'
import { Export }                                                              from '@Core/ui/Export'
import { UIToast }                                                             from '@Utils/UIToast'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS, UnitUtils } from '@Utils/UnitUtils'
import {
    WaCopyButton, WaDivider, WaIcon, WaSwitch,
}                                                                              from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useCallback, useEffect, useMemo, useState, useRef }      from 'react'
import { useSnapshot }                                              from 'valtio'
import { DateInfo }                                                 from '../DateInfo'

const DIVIDER_STYLE = {'--width': '1px'}

export const TrackData = memo(() => {
    const _rootRef = useRef(null)
    const [copyValue, setCopyValue] = useState('')

    const {track} = useSnapshot(lgs.stores.journeyEditor)
    const metrics = track?.metrics?.global

    const trackDate = useMemo(() => {
        if (!metrics || isNaN(metrics.duration)) {
            return {}
        }
        const points = track.metrics.points
        return {
            start: points[0]?.time,
            stop: points[points.length - 1]?.time,
        }
    }, [metrics, track?.metrics?.points])

    /**
     * Updates the copyable text content
     */
    useEffect(() => {
        if (!metrics || !_rootRef.current) {
            return
        }

        let _rafId
        const updateCopyValue = () => {
            if (!_rootRef.current) {
                return
            }
            setCopyValue(Export.toText('.element-row', 'title', _rootRef.current))
        }

        _rafId = requestAnimationFrame(() => {
            _rafId = requestAnimationFrame(updateCopyValue)
        })

        return () => cancelAnimationFrame(_rafId)
    }, [metrics, track])

    const handleCopySuccess = useCallback(() => {
        UIToast.success({
                            caption: 'Copy to clipboard',
                            text:    'Data copied successfully in clipboard.',
                        })
    }, [])

    if (!metrics) {
        return null
    }

    const hasDuration = metrics && !isNaN(metrics.duration)
    const hasElevation = metrics && metrics.negative?.elevation < 0 && metrics.positive?.elevation > 0
    const hasAltitude = metrics && !isNaN(metrics.minHeight) && !isNaN(metrics.maxHeight)

    return (
        <div ref={_rootRef} className="track-data-container">
            <div className="journey-profile-chart-menu">
                {lgs.theJourney.hasOneTrack() ? (
                    <WaSwitch size="xsmall" label-at-start width-auto checked={true} onChange={() => {
                    }}>
                        {'Add Data widget on scene'}
                    </WaSwitch>
                ) : (<span>&nbsp;</span>)}

                <WaCopyButton
                    onWaCopy={handleCopySuccess}
                    value={copyValue}
                    copyLabel={'Copy data'}
                    success-label={'Copied!'}
                    variant="brand"
                    size="small"
                    appearance="plain"
                />
            </div>

            <WaDivider/>

            {hasDuration && <DateInfo date={trackDate}/>}

            <div className="element-row">
                <div className="element-item title">{'Distance'}</div>
                <div className="element-item">
                    <WaIcon variant="regular" name={'route'}/>
                    <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS}/>
                </div>
            </div>

            {metrics.positive && (
                <div className="element-row">
                    <div className="element-item indented">
                        <WaIcon variant="regular" name={'arrow-up-right'}/>
                        <span className="screen-reader-only">{'Positive distance'}</span>
                        <NameValueUnit value={metrics.positive.distance} units={DISTANCE_UNITS}/>
                    </div>
                    <div className="element-item">
                        <WaIcon variant="regular" name={'arrow-down-right'}/>
                        <span className="screen-reader-only">{'Negative distance'}</span>
                        <NameValueUnit value={metrics.negative.distance} units={DISTANCE_UNITS}/>
                    </div>
                </div>
            )}

            {hasDuration && (
                <>
                    <div className="element-row">
                        <div className="element-item title">{'Duration'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'clock-desk'}/>
                            <NameValueUnit value={UnitUtils.convert(metrics.duration).toTime()}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'person-hiking'}/>
                            <span className="screen-reader-only">{'Moving time'}</span>
                            <NameValueUnit value={UnitUtils.convert(metrics.duration - metrics.idleTime).toTime()}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'pause'}/>
                            <span className="screen-reader-only">{'Idle time'}</span>
                            <NameValueUnit value={UnitUtils.convert(metrics.idleTime).toTime()}/>
                        </div>
                    </div>
                </>
            )}

            {hasElevation && (
                <>
                    <WaDivider/>
                    <div className="element-row">
                        <div className="element-item title">{'Elevation'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-up-right'}/>
                            <span className="screen-reader-only">{'Positive elevation'}</span>
                            <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS} format="%d"/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-down-right'}/>
                            <span className="screen-reader-only">{'Negative elevation'}</span>
                            <NameValueUnit value={metrics.negative.elevation} units={ELEVATION_UNITS} format="%d"/>
                        </div>
                    </div>
                </>
            )}

            {hasAltitude && (
                <div className="element-row">
                    <div className="element-item title">{'Altitude'}</div>
                    <div className="element-item">
                        <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                        <span className="screen-reader-only">{'Min altitude'}</span>
                        <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} format="%d"/>
                    </div>
                    <div className="element-item">
                        <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                        <span className="screen-reader-only">{'Max altitude'}</span>
                        <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} format="%d"/>
                    </div>
                </div>
            )}

            {hasDuration && (
                <>
                    <WaDivider/>
                    <div className="element-row">
                        <div className="element-item title">{'Speed'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'gauge-simple-high'}/>
                            <span className="screen-reader-only">{'Average speed'}</span>
                            <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'person-hiking'}/>
                            <span className="screen-reader-only">{'Average moving speed'}</span>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                            <span className="screen-reader-only">{'Min speed'}</span>
                            <NameValueUnit value={metrics.minSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                            <span className="screen-reader-only">{'Max speed'}</span>
                            <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS}/>
                        </div>
                    </div>
                </>
            )}

            {hasDuration && (
                <>
                    <WaDivider/>
                    <div className="element-row">
                        <div className="element-item title">{'Pace'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'gauge-simple-high'}/>
                            <span className="screen-reader-only">{'Average pace'}</span>
                            <NameValueUnit value={metrics.averagePace} units={PACE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'person-hiking'}/>
                            <span className="screen-reader-only">{'Average moving pace'}</span>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={PACE_UNITS}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                            <span className="screen-reader-only">{'Max pace'}</span>
                            <NameValueUnit value={metrics.maxPace} units={PACE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                            <span className="screen-reader-only">{'Min pace'}</span>
                            <NameValueUnit value={metrics.minPace} units={PACE_UNITS}/>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
})
