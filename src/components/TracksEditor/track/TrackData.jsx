/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackData.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                                                       from '@Components/DataDisplay/NameValueUnit'
import {
    EDIT_WIDGET_ICON,
    MILLIS,
    SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGET_EDITOR_POST_RENDER_EVENT, WIDGET_EDITOR_PRE_RENDER_EVENT,
    WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import { Export }                                                              from '@Core/ui/Export'
import {
    WidgetDynamicRenderer,
}                                                                              from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { UIToast }                                                             from '@Utils/UIToast'
import { useOptionalSnapshot }                                     from '@Utils/ValtioUtils'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS, UnitUtils } from '@Utils/UnitUtils'
import {
    WaButton, WaCopyButton, WaDivider, WaIcon, WaSwitch, WaTooltip,
}                                                                              from '@web.awesome.me/webawesome-pro/dist/react'
import { DateTime }                                                            from 'luxon'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                         from 'valtio'
import { DateInfo }                                                            from '../DateInfo'

const JOURNEY_STATS_FALLBACK = {show: false}

export const TrackData = memo(() => {
    const _rootRef = useRef(null)
    const [copyValue, setCopyValue] = useState('')

    // Proxies - Ensure lgs.stores.main.components.journeyStats is initialized in your store
    const $journeyStats = lgs.stores.main.components.journeyStats
    const $journeyEditor = lgs.stores.journeyEditor

    // Snapshots
    const journeyStats = useOptionalSnapshot($journeyStats, JOURNEY_STATS_FALLBACK)
    const {track} = useSnapshot($journeyEditor)

    const metrics = track?.metrics?.global
    const renderer = WidgetDynamicRenderer.instance

    const WIDGET_KEY = 'journey-stats-widget'
    const GROUP = SCENE_WIDGETS
    const HIDDEN_CLASS = 'lgs-widget-hidden'

    const ensureStatsWidget = useCallback(async () => {
        let _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!_id) {
            await renderer.renderWidget(GROUP, WIDGET_KEY, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
            _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
        }
        else if (!__.ui.widgetManager.getElementById(_id)) {
            await renderer.renderWidget(GROUP, _id, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
        }

        if (_id) {
            __.ui.widgetManager.getElementById(_id)?.classList.remove(HIDDEN_CLASS)
        }

        return _id
    }, [GROUP, renderer])

    const resetStatsWidget = useCallback(async (entity) => {
        if (!entity) {
            return
        }

        const element = __.ui.widgetManager.getElementById(entity)
        const type = entity.split('#')[0]
        const elements = lgs.settings.widgets[type]?.configuration?.elements

        if (elements?.[entity]) {
            delete elements[entity]
        }

        renderer.destroyWidget(entity)

        if (element) {
            await __.ui.widgetManager.disposeElement(element)
        }
        await __.ui.widgetManager.deleteWidgetPosition(entity)
    }, [renderer])

    /**
     * Sync initial switch state with widget presence in the scene
     */
    useEffect(() => {
        if (!$journeyStats) {
            return
        }

        let cancelled = false

        const syncStatsWidget = async () => {
            const _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

            if (_id) {
                const _el = __.ui.widgetManager.getElementById(_id)
                if (_el) {
                    $journeyStats.show = !_el.classList.contains(HIDDEN_CLASS)
                }
                return
            }

            if (journeyStats.show && metrics) {
                const entity = await ensureStatsWidget()
                if (!cancelled && entity) {
                    $journeyStats.show = true
                }
            }
        }

        syncStatsWidget()

        return () => {
            cancelled = true
        }
    }, [$journeyStats, ensureStatsWidget, journeyStats.show, metrics, renderer])

    /**
     * Toggles the journey-stats widget visibility on the scene
     */
    const toggleStatsWidget = useCallback(async () => {
        if (!$journeyStats) {
            return
        }

        let _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!_id) {
            await ensureStatsWidget()
            $journeyStats.show = true
            return
        }

        if (lgs.stores.ui.widget.restrictions.has(_id)) {
            return
        }

        const _el = __.ui.widgetManager.getElementById(_id)
        const _nextState = !journeyStats.show

        if (!_nextState) {
            await resetStatsWidget(_id)
            $journeyStats.show = false

            if (lgs.stores.ui.drawers.open === WIDGETS_EDITOR_DRAWER) {
                lgs.stores.ui.drawers.open = null
            }
            return
        }

        if (_el) {
            _el.classList.remove(HIDDEN_CLASS)
        }
        else {
            await ensureStatsWidget()
        }

        $journeyStats.show = true
    }, [$journeyStats, ensureStatsWidget, journeyStats.show, renderer, resetStatsWidget])

    /**
     * Auto-hide: If no metrics are available, remove the widget from the scene
     */
    useEffect(() => {
        if (!metrics && journeyStats.show && $journeyStats) {
            const _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
            if (_id) {
                const _el = __.ui.widgetManager.getElementById(_id)
                if (_el && !_el.classList.contains(HIDDEN_CLASS)) {
                    _el.classList.add(HIDDEN_CLASS)
                    $journeyStats.show = false
                }
            }
        }
    }, [$journeyStats, metrics, journeyStats.show, renderer])

    useEffect(() => {
        if (!$journeyStats || !journeyStats.show || !metrics) {
            return
        }

        let cancelled = false

        ensureStatsWidget().then(entity => {
            if (!cancelled && entity) {
                $journeyStats.show = true
            }
        })

        return () => {
            cancelled = true
        }
    }, [$journeyStats, ensureStatsWidget, journeyStats.show, metrics])

    const trackDate = useMemo(() => {
        if (!metrics || isNaN(metrics.duration)) {
            return {}
        }

        const points = Array.isArray(track?.metrics?.points) ? track.metrics.points : []
        if (points.length === 0) {
            return {}
        }

        return {
            start: points[0]?.time,
            stop: points[points.length - 1]?.time,
        }
    }, [metrics, track?.metrics?.points])

    /**
     * Updates the copyable text content for the clipboard
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

            const _lines = []

            // 1. Journey Title + ===
            const _jTitle = lgs.theJourney.title || ''
            _lines.push(_jTitle)
            _lines.push('='.repeat(_jTitle.length))

            // 2. Track Title + --- (if several tracks)
            if (lgs.theJourney.hasSeveralTracks()) {
                const _tTitle = lgs.theTrack.title || ''
                _lines.push(_tTitle)
                _lines.push('-'.repeat(_tTitle.length))
            }

            // 3. Dates with Luxon (Same day logic)
            if (trackDate.start && trackDate.stop) {
                const _start = DateTime.fromISO(trackDate.start)
                const _stop = DateTime.fromISO(trackDate.stop)

                const _startDateStr = _start.toLocaleString(DateTime.DATE_FULL)
                const _stopDateStr = _stop.toLocaleString(DateTime.DATE_FULL)
                const _startTime = _start.toLocaleString(DateTime.TIME_SIMPLE)
                const _stopTime = _stop.toLocaleString(DateTime.TIME_SIMPLE)

                if (_startDateStr === _stopDateStr) {
                    _lines.push(`${_startDateStr} [${_startTime}-${_stopTime}]`)
                }
                else {
                    _lines.push(`${_startDateStr} [${_startTime}] - ${_stopDateStr} [${_stopTime}]`)
                }
            }

            _lines.push('') // Empty line before metrics

            // 4. Metrics from DOM (scoped to component ref)
            const _domMetrics = Export.toText('.element-row', 'title', _rootRef.current)
            if (_domMetrics) {
                _lines.push(_domMetrics)
            }

            setCopyValue(_lines.join('\n'))
        }

        _rafId = requestAnimationFrame(() => {
            _rafId = requestAnimationFrame(updateCopyValue)
        })

        return () => cancelAnimationFrame(_rafId)
    }, [metrics, track, trackDate])

    const handleCopySuccess = useCallback(() => {
        UIToast.success({
                            caption: 'Copy to clipboard',
                            text:    'Data copied successfully in clipboard.',
                        })
    }, [])

    if (!metrics) {
        return null
    }

    const openWidgetJourneyStatsEditor = async () => {
        let entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!entity) {
            entity = await ensureStatsWidget()
        }

        if (!entity) {
            return
        }

        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
            detail: {entity},
        }))
        __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
            action:  'edit-current',
            entity,
            stacked: true,
        })
        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_POST_RENDER_EVENT, {
            detail: {entity},
        }))
    }
    const hasDuration = metrics && !isNaN(metrics.duration)
    const hasElevation = metrics && metrics.negative?.elevation < 0 && metrics.positive?.elevation > 0
    const hasAltitude = metrics && !isNaN(metrics.minHeight) && !isNaN(metrics.maxHeight)

    return (
        <div ref={_rootRef} className="track-data-container">
            <div className="journey-profile-chart-menu">
                <WaSwitch
                    size="xsmall"
                    label-at-start
                    width-auto
                    checked={journeyStats.show}
                    onChange={toggleStatsWidget}
                >
                    {'Add Data widget on scene'}
                </WaSwitch>

                {lgs.theJourney.hasOneTrack() && (
                    <>
                        {journeyStats.show &&
                            <>
                                <WaTooltip for="edit-stats-widget-in-settings">{'Edit widget'}</WaTooltip>
                                <WaButton
                                    id="edit-stats-widget-in-settings"
                                    appearance="plain"
                                    variant="brand"
                                    onClick={openWidgetJourneyStatsEditor}>
                                    <WaIcon variant="regular" name={EDIT_WIDGET_ICON}/>
                                </WaButton>
                            </>
                        }

                        <WaCopyButton
                            onWaCopy={handleCopySuccess}
                            value={copyValue}
                            copyLabel={'Copy data'}
                            success-label={'Copied!'}
                            variant="brand"
                            size="small"
                            appearance="plain"
                        />
                    </>
                )
                }
            </div>

            <WaDivider/>

            <DateInfo date={trackDate} track={track}/>

            {
                lgs.theJourney.hasSeveralTracks() && (
                    <div className="copy-button-wrapper">
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
                )
            }

            {/* Metrics Rows */
            }
            <div className="element-row">
                <div className="element-item title">{'Distance'}</div>
                <div className="element-item">
                    <WaIcon variant="regular" name={'route'}/>
                    <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS}/>
                </div>
            </div>

            {
                metrics.positive && (
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'arrow-up-right'}/>
                            <span className="screen-reader-only">{'Positive:'}</span>
                            <NameValueUnit value={metrics.positive.distance} units={DISTANCE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-down-right'}/>
                            <span className="screen-reader-only">{'Negative:'}</span>
                            <NameValueUnit value={metrics.negative.distance} units={DISTANCE_UNITS}/>
                        </div>
                    </div>
                )
            }

            {
                hasDuration && (
                    <>
                        <div className="element-row">
                            <div className="element-item title">{'Duration'}</div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'clock-desk'}/>
                                <NameValueUnit value={UnitUtils.convert(metrics.duration * MILLIS).toTime(false)}/>
                            </div>
                        </div>
                        <div className="element-row">
                            <div className="element-item indented">
                                <WaIcon variant="regular" name={'person-hiking'}/>
                                <span className="screen-reader-only">{'Moving time:'}</span>
                                <NameValueUnit
                                    value={UnitUtils.convert((metrics.duration - metrics.idleTime) * MILLIS).toTime(false)}/>
                            </div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'pause'}/>
                                <span className="screen-reader-only">{'Idle time:'}</span>
                                <NameValueUnit value={UnitUtils.convert(metrics.idleTime * MILLIS).toTime(false)}/>
                            </div>
                        </div>
                    </>
                )
            }

            {
                hasElevation && (
                    <>
                        <WaDivider/>
                        <div className="element-row">
                            <div className="element-item title">{'Elevation'}</div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'arrow-up-right'}/>
                                <span className="screen-reader-only">{'Positive:'}</span>
                                <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS} format="%d"/>
                            </div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'arrow-down-right'}/>
                                <span className="screen-reader-only">{'Negative:'}</span>
                                <NameValueUnit value={metrics.negative.elevation} units={ELEVATION_UNITS} format="%d"/>
                            </div>
                        </div>
                    </>
                )
            }

            {
                hasAltitude && (
                    <div className="element-row">
                        <div className="element-item title">{'Altitude'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                            <span className="screen-reader-only">{'Min:'}</span>
                            <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} format="%d"/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                            <span className="screen-reader-only">{'Max:'}</span>
                            <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} format="%d"/>
                        </div>
                    </div>
                )
            }

            {
                hasDuration && (
                    <>
                        <WaDivider/>
                        <div className="element-row">
                            <div className="element-item title">{'Speed'}</div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'gauge-simple-high'}/>
                                <span className="screen-reader-only">{'Average:'}</span>
                                <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS}/>
                            </div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                                <span className="screen-reader-only">{'Max:'}</span>
                                <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS}/>
                            </div>
                        </div>
                    </>
                )
            }

            {
                hasDuration && (
                    <>
                        <WaDivider/>
                        <div className="element-row">
                            <div className="element-item title">{'Pace'}</div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'gauge-simple-high'}/>
                                <span className="screen-reader-only">{'Average:'}</span>
                                <NameValueUnit value={metrics.averagePace} units={PACE_UNITS}/>
                            </div>
                            <div className="element-item">
                                <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                                <span className="screen-reader-only">{'Best:'}</span>
                                <NameValueUnit value={metrics.minPace} units={PACE_UNITS}/>
                            </div>
                        </div>
                    </>
                )
            }
        </div>
    )
})
