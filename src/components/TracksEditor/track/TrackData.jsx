/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackData.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                                                       from '@Components/DataDisplay/NameValueUnit'
import {
    EDIT_WIDGET_ICON,
    MILLIS,
    POI_THRESHOLD_DISTANCE,
    POI_TMP_TYPE,
    SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGET_EDITOR_POST_RENDER_EVENT, WIDGET_EDITOR_PRE_RENDER_EVENT,
    WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import { MapPOI }                                                              from '@Core/MapPOI'
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
import { Cartographic, Rectangle }                                             from 'cesium'
import { DateTime }                                                            from 'luxon'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                         from 'valtio'
import { DateInfo }                                                            from '../DateInfo'

const JOURNEY_STATS_FALLBACK = {show: false}
const JOURNEY_METRICS_FALLBACK = {global: {}, external: {}, user: {}}
const STATS_POI_ID_PREFIX = 'journey-stat-extreme'
const EXTREME_VALUE_TOLERANCE = 1e-9
const COORDINATE_PRECISION = 6
const STATS_POI_SCREEN_CLUSTER_PX = 96
const STATS_POI_GEO_CLUSTER_METERS = POI_THRESHOLD_DISTANCE * 4
const LINE_STRING = 'LineString'
const MULTI_LINE_STRING = 'MultiLineString'

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const matchesMetricValue = (value, target) => {
    const current = finiteNumber(value)
    const expected = finiteNumber(target)

    if (current === null || expected === null) {
        return false
    }

    return Math.abs(current - expected) <= Math.max(EXTREME_VALUE_TOLERANCE, Math.abs(expected) * EXTREME_VALUE_TOLERANCE)
}

const coordinateKey = point => {
    const longitude = finiteNumber(point.longitude)
    const latitude = finiteNumber(point.latitude)

    return [
        longitude?.toFixed(COORDINATE_PRECISION),
        latitude?.toFixed(COORDINATE_PRECISION),
    ].join(':')
}

const uniquePointsByCoordinates = points => {
    const seen = new Set()

    return points.filter(point => {
        const longitude = finiteNumber(point.longitude)
        const latitude = finiteNumber(point.latitude)

        if (longitude === null || latitude === null) {
            return false
        }

        const key = coordinateKey(point)
        if (seen.has(key)) {
            return false
        }

        seen.add(key)
        return true
    })
}

const distanceMeters = (pointA, pointB) => {
    const lonA = finiteNumber(pointA?.longitude)
    const latA = finiteNumber(pointA?.latitude)
    const lonB = finiteNumber(pointB?.longitude)
    const latB = finiteNumber(pointB?.latitude)

    if (lonA === null || latA === null || lonB === null || latB === null) {
        return Infinity
    }

    const toRadians = degrees => degrees * Math.PI / 180
    const earthRadiusMeters = 6378137
    const dLat = toRadians(latB - latA)
    const dLon = toRadians(lonB - lonA)
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const clusterStatsPOIPoints = async points => {
    const clusters = []

    for (const point of points) {
        const longitude = finiteNumber(point.longitude)
        const latitude = finiteNumber(point.latitude)

        if (longitude === null || latitude === null) {
            continue
        }

        let screenPoint = null
        try {
            const coords = await __.ui.sceneManager?.degreesToPixelsCoordinates?.({
                                                                                      longitude,
                                                                                      latitude,
                                                                                      height:          point.height,
                                                                                      simulatedHeight: point.simulatedHeight ?? point.altitude,
                                                                                  }, true)
            if (coords?.visible && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
                screenPoint = {x: coords.x, y: coords.y}
            }
        }
        catch {
            screenPoint = null
        }

        const existing = clusters.find(cluster => {
            if (screenPoint && cluster.screenPoint) {
                return Math.hypot(screenPoint.x - cluster.screenPoint.x, screenPoint.y - cluster.screenPoint.y)
                    <= STATS_POI_SCREEN_CLUSTER_PX
            }

            return distanceMeters(point, cluster.point) <= STATS_POI_GEO_CLUSTER_METERS
        })

        if (!existing) {
            clusters.push({point, longitude, latitude, screenPoint})
        }
    }

    return clusters.map(cluster => cluster.point)
}

const extractTrackAltitudePoints = track => {
    const geometry = track?.content?.geometry

    if (!geometry) {
        return []
    }

    const segments = geometry.type === LINE_STRING
                     ? [geometry.coordinates]
                     : geometry.type === MULTI_LINE_STRING
                       ? geometry.coordinates
                       : []
    const times = track?.content?.properties?.coordinateProperties?.times
    const points = []
    let timeCursor = 0

    segments.forEach((segment, segmentIndex) => {
        if (!Array.isArray(segment)) {
            return
        }

        let segmentTimes = []
        if (geometry.type === LINE_STRING && Array.isArray(times)) {
            segmentTimes = times
        }
        else if (Array.isArray(times?.[segmentIndex])) {
            segmentTimes = times[segmentIndex]
        }
        else if (Array.isArray(times)) {
            segmentTimes = times.slice(timeCursor, timeCursor + segment.length)
        }
        timeCursor += segment.length

        segment.forEach((coordinates, index) => {
            if (!Array.isArray(coordinates)) {
                return
            }

            const longitude = finiteNumber(coordinates[0])
            const latitude = finiteNumber(coordinates[1])
            const altitude = finiteNumber(coordinates[2])

            if (longitude === null || latitude === null || altitude === null) {
                return
            }

            points.push({
                            longitude,
                            latitude,
                            altitude,
                            time: segmentTimes[index],
                        })
        })
    })

    return uniquePointsByCoordinates(points)
}

const findExtremePoints = (points, valueSelector, value) => {
    return uniquePointsByCoordinates(points.filter(point => matchesMetricValue(valueSelector(point), value)))
}

const findAdjustedExtremePoints = (points, valueSelector, value, fallbackValue) => {
    const adjustedPoints = findExtremePoints(points, valueSelector, value)

    if (adjustedPoints.length || fallbackValue === undefined || matchesMetricValue(value, fallbackValue)) {
        return adjustedPoints
    }

    return findExtremePoints(points, valueSelector, fallbackValue)
}

const mergeMetricSources = (...sources) => {
    const merged = {}

    sources.forEach(source => {
        if (!source || typeof source !== 'object') {
            return
        }

        Object.entries(source).forEach(([key, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = mergeMetricSources(merged[key], value)
                return
            }

            if (value !== undefined) {
                merged[key] = value
            }
        })
    })

    return merged
}

const isPointInCurrentView = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)

    if (longitude === null || latitude === null || !lgs.camera || !lgs.scene?.globe?.ellipsoid) {
        return false
    }

    const visibleRectangle = lgs.camera.computeViewRectangle(lgs.scene.globe.ellipsoid)
    if (!visibleRectangle) {
        return false
    }

    return Rectangle.contains(visibleRectangle, Cartographic.fromDegrees(longitude, latitude))
}

export const TrackData = memo(() => {
    const _rootRef = useRef(null)
    const _statsPoiIds = useRef([])
    const [copyValue, setCopyValue] = useState('')
    const [activeStatsPoiId, setActiveStatsPoiId] = useState(null)

    // Proxies - Ensure lgs.stores.main.components.journeyStats is initialized in your store
    const $journeyStats = lgs.stores.main.components.journeyStats
    const $journeyEditor = lgs.stores.journeyEditor

    // Snapshots
    const journeyStats = useOptionalSnapshot($journeyStats, JOURNEY_STATS_FALLBACK)
    const {track} = useSnapshot($journeyEditor)
    const journeyMetrics = useOptionalSnapshot(lgs.theJourney?.metrics, JOURNEY_METRICS_FALLBACK)

    const trackMetrics = track?.metrics?.global
    const metrics = useMemo(() => {

        if (!lgs.theJourney?.hasOneTrack?.()) {
            return trackMetrics
        }

        return mergeMetricSources(
            trackMetrics,
            journeyMetrics.external,
            journeyMetrics.user,
        )
    }, [journeyMetrics.external, journeyMetrics.user, trackMetrics])
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

    const getStatsPOIIds = useCallback(() => {
        const ids = new Set(_statsPoiIds.current)
        const poiList = __.ui.poiManager?.list

        if (poiList?.keys) {
            for (const poiId of poiList.keys()) {
                if (`${poiId}`.startsWith(STATS_POI_ID_PREFIX)) {
                    ids.add(poiId)
                }
            }
        }

        return Array.from(ids)
    }, [])

    const removeStatsPOIEntities = useCallback(() => {
        if (!lgs.viewer) {
            return
        }

        const removeFrom = entities => {
            if (!entities?.values) {
                return
            }

            Array.from(entities.values).forEach(entity => {
                if (`${entity.id}`.startsWith(STATS_POI_ID_PREFIX)) {
                    entities.remove(entity)
                }
            })
        }

        removeFrom(lgs.viewer.entities)
        for (let index = 0; index < lgs.viewer.dataSources.length; index++) {
            removeFrom(lgs.viewer.dataSources.get(index).entities)
        }
        lgs.viewer.scene.requestRender?.()
    }, [])

    const removeStatsPOIs = useCallback(async () => {
        const ids = getStatsPOIIds()
        _statsPoiIds.current = []

        if (!ids.length || !__.ui.poiManager?.remove) {
            removeStatsPOIEntities()
            return
        }

        await Promise.all(ids.map(id => __.ui.poiManager.remove({id, dbSync: false})
            .catch(error => console.error(`Failed to remove journey statistics POI ${id}:`, error))))
        removeStatsPOIEntities()
    }, [getStatsPOIIds, removeStatsPOIEntities])

    const clearStatsPOIs = useCallback(async () => {
        await removeStatsPOIs()
        setActiveStatsPoiId(null)
    }, [removeStatsPOIs])

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

    useEffect(() => {
        void removeStatsPOIs()

        return () => {
            void removeStatsPOIs()
        }
    }, [removeStatsPOIs, track?.slug])

    useEffect(() => {
        setActiveStatsPoiId(null)
    }, [track?.slug])


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

    const metricPoints = useMemo(() => {
        return Array.isArray(track?.metrics?.points) ? uniquePointsByCoordinates(track.metrics.points) : []
    }, [track?.metrics?.points])

    const altitudePoints = useMemo(() => {
        const extracted = extractTrackAltitudePoints(track)
        return extracted.length > 0 ? extracted : metricPoints
    }, [metricPoints, track])

    const showStatsPOIs = useCallback(async ({
                                                 id,
                                                 label,
                                                 value,
                                                 units,
                                                 format,
                                                 points,
                                             }) => {
        if (activeStatsPoiId === id && getStatsPOIIds().length > 0) {
            await clearStatsPOIs()
            return
        }

        await clearStatsPOIs()

        if (!__.ui.poiManager?.add || !Array.isArray(points) || points.length === 0) {
            return
        }

        const metric = UnitUtils.formatMetric(value, {units, format})
        const formattedValue = metric.full?.trim() || `${value}`
        const parent = track?.slug ?? lgs.theTrack?.slug ?? null

        const clusteredPoints = await clusterStatsPOIPoints(points)
        const createdPOIs = await Promise.all(clusteredPoints.map(async (point, index) => {
            const longitude = finiteNumber(point.longitude)
            const latitude = finiteNumber(point.latitude)

            if (longitude === null || latitude === null) {
                return null
            }

            const height = finiteNumber(point.simulatedHeight ?? point.altitude ?? point.height)
            const poi = new MapPOI({
                                       id:              `${STATS_POI_ID_PREFIX}:${parent ?? 'journey'}:${id}:${index}`,
                                       parent,
                                       type:            POI_TMP_TYPE,
                                       title:           `${label}: ${formattedValue}`,
                                       description:     `${label}: ${formattedValue}`,
                                       skipLocationUpdate: true,
                                       longitude,
                                       latitude,
                                       height:          height ?? undefined,
                                       simulatedHeight: height ?? undefined,
                                       time:            point.time,
                                       distance:        point.distance,
                                       expanded:        true,
                                       visible:         true,
                                   })

            return __.ui.poiManager.add(poi, false, false)
        }))

        _statsPoiIds.current = createdPOIs.filter(Boolean).map(poi => poi.id)
        setActiveStatsPoiId(_statsPoiIds.current.length > 0 ? id : null)

        const visiblePOI = createdPOIs.filter(Boolean).find(isPointInCurrentView)
        if (!visiblePOI && _statsPoiIds.current.length > 0) {
            await __.ui.poiManager.focusPOI(_statsPoiIds.current[0])
        }
    }, [activeStatsPoiId, clearStatsPOIs, getStatsPOIIds, track?.slug])

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
    const minAltitudePoints = findAdjustedExtremePoints(
        altitudePoints, point => point.altitude, metrics.minHeight, trackMetrics?.minHeight,
    )
    const maxAltitudePoints = findAdjustedExtremePoints(
        altitudePoints, point => point.altitude, metrics.maxHeight, trackMetrics?.maxHeight,
    )
    const maxSpeedPoints = findAdjustedExtremePoints(
        metricPoints, point => point.speed, metrics.maxSpeed, trackMetrics?.maxSpeed,
    )
    const bestPacePoints = findAdjustedExtremePoints(
        metricPoints, point => point.pace, metrics.minPace, trackMetrics?.minPace,
    )

    const renderExtremeMetric = ({
                                     id,
                                     label,
                                     icon,
                                     value,
                                     units,
                                     format,
                                     points,
                                     visibleText,
                                 }) => {
        const buttonId = `show-${id}-on-map`
        const isActive = activeStatsPoiId === id

        return (
            <div className="element-item">
                <WaTooltip
                    for={buttonId}
                    placement="top"
                    content={isActive ? 'Hide from map' : 'Show on map'}></WaTooltip>
                <WaButton
                    id={buttonId}
                    className={`track-data-extreme-button${isActive ? ' is-active' : ''}`}
                    appearance="plain"
                    variant="brand"
                    aria-pressed={isActive}
                    disabled={!points.length}
                    onClick={() => showStatsPOIs({id, label, value, units, format, points})}>
                    <WaIcon variant="regular" name={icon}/>
                    <span className="screen-reader-only">{visibleText}</span>
                    <NameValueUnit value={value} units={units} format={format}/>
                </WaButton>
            </div>
        )
    }

    return (
        <div ref={_rootRef} className="track-data-container">
            <div className="journey-profile-chart-menu">
                <WaSwitch
                    size="xs"
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
                            size="s"
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
                            size="s"
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
                        {renderExtremeMetric({
                                                  id:          'min-altitude',
                                                  label:       'Minimum altitude',
                                                  icon:        'arrow-down-to-line',
                                                  value:       metrics.minHeight,
                                                  units:       ELEVATION_UNITS,
                                                  format:      '%d',
                                                  points:      minAltitudePoints,
                                                  visibleText: 'Min:',
                                              })}
                        {renderExtremeMetric({
                                                  id:          'max-altitude',
                                                  label:       'Maximum altitude',
                                                  icon:        'arrow-up-to-line',
                                                  value:       metrics.maxHeight,
                                                  units:       ELEVATION_UNITS,
                                                  format:      '%d',
                                                  points:      maxAltitudePoints,
                                                  visibleText: 'Max:',
                                              })}
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
                            {renderExtremeMetric({
                                                      id:          'max-speed',
                                                      label:       'Maximum speed',
                                                      icon:        'arrow-up-to-line',
                                                      value:       metrics.maxSpeed,
                                                      units:       SPEED_UNITS,
                                                      points:      maxSpeedPoints,
                                                      visibleText: 'Max:',
                                                  })}
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
                            {renderExtremeMetric({
                                                      id:          'best-pace',
                                                      label:       'Best pace',
                                                      icon:        'arrow-up-to-line',
                                                      value:       metrics.minPace,
                                                      units:       PACE_UNITS,
                                                      points:      bestPacePoints,
                                                      visibleText: 'Best:',
                                                  })}
                        </div>
                    </>
                )
            }
        </div>
    )
})
