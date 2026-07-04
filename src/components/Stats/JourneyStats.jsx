/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStats.jsx
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

import { NameValueUnit }                                from '@Components/DataDisplay/NameValueUnit'
import { DateTimeDisplay }                              from '@Components/DateTimeDisplay'
import { useWidgetScaleCorrection } from '@Components/MainUI/widgets/useWidgetScaleCorrection'
import { VIDEO_WIDGETS_BOARD }                          from '@Core/constants'
import {
    JOURNEY_STATS_TEXT_ITEM_MAP,
    isJourneyStatsSummaryTextItem,
    isJourneyStatsTextItemEnabled,
    normalizeJourneyStatsSummaryBreaks,
    normalizeJourneyStatsTextOrder,
}                                                       from '@Components/Stats/journeyStatsTextOrder'
import {
    buildDynamicJourneyReplayStatsMetrics,
    shouldShowVideoStatsWidget,
}                                                       from '@Components/Stats/replayStatsWidgetUtils'
import { WIDGET_RADIUS }                                from '@Core/constants'
import { faArrowDownToLine, faArrowUpToLine }           from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlIcon }                            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                        from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS, UnitUtils } from '@Utils/UnitUtils'
import { useOptionalSnapshot }                          from '@Utils/ValtioUtils'
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                  from 'valtio'

const scaleValue = (value, correction = 1) => {
    const numericValue = Number(value)
    const numericCorrection = Number(correction)

    if (!Number.isFinite(numericValue)) {
        return 0
    }

    return numericValue * (Number.isFinite(numericCorrection) ? numericCorrection : 1)
}

const scaleRadius = (radius, correction = 1) => {
    const normalizedCorrection = Number(correction)
    const scale = Number.isFinite(normalizedCorrection) ? normalizedCorrection : 1
    const value = String(radius ?? '0').trim()

    if (value === '0') {
        return '0'
    }

    return `calc(${value} * ${scale})`
}

const resolvePadding = (element, correction = 1, fallback = 16) => {
    const padding = element?.padding ?? {}
    const paddingCorrection = (padding.scaled ?? false) === false ? correction : 1

    const getValue = side => scaleValue(padding[side] ?? fallback, paddingCorrection)

    return `${getValue('top')}px ${getValue('right')}px ${getValue('bottom')}px ${getValue('left')}px`
}

const getMeasuredSize = (element, dimension, fallback = 0) => {
    if (!element) {
        return fallback
    }

    const keys = dimension === 'height'
                 ? ['offsetHeight', 'scrollHeight']
                 : ['offsetWidth', 'scrollWidth']
    const layoutSize = Math.max(
        element[keys[0]] ?? 0,
        element[keys[1]] ?? 0,
        fallback,
    )

    if (Number.isFinite(layoutSize) && layoutSize > 0) {
        return Math.ceil(layoutSize)
    }

    const rect = element.getBoundingClientRect?.()
    const rectValue = dimension === 'height' ? rect?.height : rect?.width
    return Number.isFinite(rectValue) && rectValue > 0 ? Math.ceil(rectValue) : fallback
}

const getRenderedSize = (element, dimension) => {
    if (!element) {
        return 0
    }

    const styleValue = parseFloat(element.style?.[dimension] || '')
    if (Number.isFinite(styleValue) && styleValue > 0) {
        return styleValue
    }

    const layoutSize = dimension === 'height' ? element.offsetHeight : element.offsetWidth

    if (Number.isFinite(layoutSize) && layoutSize > 0) {
        return Math.ceil(layoutSize)
    }

    const rect = element.getBoundingClientRect?.()
    const rectValue = dimension === 'height' ? rect?.height : rect?.width
    return Number.isFinite(rectValue) && rectValue > 0 ? Math.ceil(rectValue) : 0
}

const measureUnconstrainedContent = (target, content) => {
    const previousWidth = target.style.width
    const previousHeight = target.style.height

    target.style.width = 'auto'
    target.style.height = 'auto'

    const width = getMeasuredSize(content, 'width')
    const height = getMeasuredSize(content, 'height')

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        target.style.width = previousWidth
        target.style.height = previousHeight
        return null
    }

    return {width, height}
}

const getCurrentWidgetBox = (target, config) => {
    const rect = target?.getBoundingClientRect?.()
    const left = Number.parseFloat(target?.style?.left || '')
    const top = Number.parseFloat(target?.style?.top || '')
    const width = Number.parseFloat(target?.style?.width || '')
    const height = Number.parseFloat(target?.style?.height || '')

    return {
        left:   Number.isFinite(left) ? left : (config?.position?.left ?? rect?.left ?? 0),
        top:    Number.isFinite(top) ? top : (config?.position?.top ?? rect?.top ?? 0),
        width:  Number.isFinite(width) && width > 0 ? width : (config?.dimensions?.width ?? rect?.width ?? 0),
        height: Number.isFinite(height) && height > 0 ? height : (config?.dimensions?.height ?? rect?.height ?? 0),
    }
}

const resolveWidgetConfiguration = (widgetKey) => {
    const widgets = lgs.settings.widgets ?? {}
    return widgets?.[widgetKey]?.configuration
           ?? __.widgets.get(widgetKey)?.configuration
           ?? null
}

/**
 * Statistical display component for journeys.
 * Maintains layout consistency by preserving slots even when values are zero.
 */
export const JourneyStats = memo(({id, metrics, units, style = {}, mode = 'journey', widgetKey = 'journey-stats-widget', widgetsBoard = null}) => {
    const main = useSnapshot(lgs.stores.main)
    const journey = lgs.theJourney
    const journeySlug = main.theJourney?.slug ?? null
    const scaleCorrection = useWidgetScaleCorrection(id)
    const [journeyLocationState, setJourneyLocationState] = useState({slug: null, value: ''})
    const widgetRef = useRef(null)

    const configuration = useOptionalSnapshot(
        resolveWidgetConfiguration(widgetKey),
        {default: {}, user: {}, elements: {}},
    )

    const fallbackMetrics = useMemo(() => metrics ?? {}, [metrics])
    const $metrics = journey?.metrics ?? lgs.stores.main.components.journeyStats
    const metricsSnap = useSnapshot($metrics)

    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem)
    const currentUnitSystem = unitSystem.current
    const isImperial = currentUnitSystem === 'imperial'
    const replay = useSnapshot(lgs.stores.replay)
    useSnapshot(lgs.stores.ui.video)
    const isDynamicMode = mode === 'dynamic'
    const isVideoBoard = widgetsBoard === VIDEO_WIDGETS_BOARD
    const element = useMemo(() => {
        if (id && configuration.elements?.[id]) {
            return configuration.elements[id]
        }
        return configuration.user ?? configuration.default
    }, [id, configuration])

    const [dynamicStatsTick, setDynamicStatsTick] = useState(0)
    const replayController = __.ui?.replay?.controller ?? null

    useEffect(() => {
        if (!isDynamicMode || !replay?.playing) {
            return undefined
        }

        const raf = globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 16))
        const caf = globalThis.cancelAnimationFrame ?? clearTimeout
        let rafId = 0
        let cancelled = false

        const tick = () => {
            if (cancelled) {
                return
            }

            setDynamicStatsTick(current => current + 1)
            rafId = raf(tick)
        }

        rafId = raf(tick)

        return () => {
            cancelled = true
            caf(rafId)
        }
    }, [isDynamicMode, replay?.playing])

    const dynamicReplaySample = useMemo(() => {
        if (!isDynamicMode) {
            return null
        }

        return replayController?.currentSample?.() ?? replay?.sample ?? null
    }, [dynamicStatsTick, isDynamicMode, replay, replayController])

    /**
     * Merges metrics based on defined data source (global, external, user)
     */
    const displayMetrics = useMemo(() => {
        if (isDynamicMode) {
            return buildDynamicJourneyReplayStatsMetrics(replay, journey, dynamicReplaySample)
        }

        const source = element.dataSource || 'global'
        const global = metricsSnap.global || fallbackMetrics.global || {}
        const external = metricsSnap.external || fallbackMetrics.external || {}
        const user = metricsSnap.user || fallbackMetrics.user || {}

        if (source === 'global') {
            return global
        }

        return {
            ...global,
            ...(source === 'external' ? external : {}),
            ...(source === 'user' ? {...external, ...user} : {}),
            positive: {
                ...(global.positive || {}),
                ...(source === 'external' ? (external.positive || {}) : {}),
                ...(source === 'user' ? {...(external.positive || {}), ...(user.positive || {})} : {}),
            }
        }
    }, [dynamicReplaySample, element.dataSource, fallbackMetrics, replay, isDynamicMode, metricsSnap])

    const formattedDuration = useMemo(() => {
        const seconds = displayMetrics?.duration
        if (!Number.isFinite(seconds) || seconds < 0) {
            return null
        }

        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const hh = String(hours).padStart(2, '0')
        const mm = String(mins).padStart(2, '0')

        if (isImperial) {
            return `${hh}:${mm}`
        }

        return (
            <>
                {hh}<span className="duration-hour">h</span>{mm}<span className="duration-minute">m</span>
            </>
        )
    }, [displayMetrics?.duration, isImperial])

    const formatPace = useCallback((pace) => {
        if (!Number.isFinite(pace) || pace <= 0) {
            return null
        }
        const paceMinutes = UnitUtils.convert(pace).to(PACE_UNITS[currentUnitSystem])
        if (!Number.isFinite(paceMinutes) || paceMinutes <= 0) {
            return null
        }
        const paceSeconds = Math.round(paceMinutes * 60)
        const m = Math.floor(paceSeconds / 60)
        const s = paceSeconds % 60
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }, [currentUnitSystem])

    const paceValues = useMemo(() => ({
        average: formatPace(displayMetrics?.averagePace),
        min: formatPace(displayMetrics?.minPace),
    }), [displayMetrics?.averagePace, displayMetrics?.minPace, formatPace])

    const hasDuration = isDynamicMode ? Boolean(replay?.elapsedMillis) : (journey?.hasTime ?? false)
    const hasElevation = isDynamicMode
                         ? displayMetrics?.hasElevation !== false
                         : (journey?.hasAltitude ?? false)
    const date = journey ? __.ui.ui.formatJourneyDurationDates(journey.getDate()) : {}
    const hasDateRange = Boolean(date?.prefix && date?.sufix)
    const journeyLocation = (journeyLocationState.slug === journeySlug ? journeyLocationState.value : '') || journey?.location || ''
    const showDate = hasDuration && element?.date && hasDateRange
    const showLocation = Boolean(element?.location && journeyLocation)
    const textOrder = useMemo(
        () => normalizeJourneyStatsTextOrder(element?.textOrder),
        [element?.textOrder],
    )
    const summaryBreaks = useMemo(
        () => new Set(normalizeJourneyStatsSummaryBreaks(element?.summaryBreaks)),
        [element?.summaryBreaks],
    )
    const showAltitudeRow = !isDynamicMode
                            && (hasElevation || element?.altitude)
                            && (displayMetrics.minHeight > 0 || displayMetrics.maxHeight > 0)
    const showSpeedRow = element?.performance && (displayMetrics.averageSpeed > 0 || displayMetrics.maxSpeed > 0)
    const showPaceRow = element?.performance && (paceValues.average !== null || paceValues.min !== null)

    const visibleTextGroups = useMemo(() => {
        const visibleById = {
            date:      showDate,
            location:  showLocation,
            distance:  isDynamicMode ? displayMetrics.distance >= 0 : (isJourneyStatsTextItemEnabled(element, 'distance') && displayMetrics.distance > 0),
            elevation: isJourneyStatsTextItemEnabled(element, 'elevation')
                       && (isDynamicMode ? hasElevation : (displayMetrics.positive?.elevation > 0 || displayMetrics.positive?.elevation === 0)),
            duration:  isDynamicMode ? Boolean(formattedDuration) : (isJourneyStatsTextItemEnabled(element, 'duration') && Boolean(formattedDuration)),
            altitude:  showAltitudeRow,
            speed:     showSpeedRow,
            pace:      showPaceRow,
        }

        return textOrder.reduce((groups, itemId) => {
            const item = JOURNEY_STATS_TEXT_ITEM_MAP.get(itemId)

            if (!item || !visibleById[itemId]) {
                return groups
            }

            const previousGroup = groups[groups.length - 1]
            const forcedSummaryBreak = isJourneyStatsSummaryTextItem(itemId) && summaryBreaks.has(itemId)

            if (previousGroup?.group === item.group && !forcedSummaryBreak) {
                previousGroup.items.push(itemId)
                return groups
            }

            groups.push({group: item.group, items: [itemId]})
            return groups
        }, [])
    }, [
        displayMetrics.distance,
        displayMetrics.positive?.elevation,
        hasElevation,
        element,
        formattedDuration,
        showAltitudeRow,
        showDate,
        showLocation,
        showPaceRow,
        showSpeedRow,
        summaryBreaks,
        textOrder,
    ])

    const syncWidgetFrame = useCallback((attempt = 0) => {
        if (!id) {
            return
        }

        requestAnimationFrame(() => {
            const widgetManager = globalThis.__?.ui?.widgetManager
            if (!widgetManager) {
                return
            }

            const moveable = widgetManager.getMoveable(id)?.current

            if (!moveable) {
                if (attempt < 6) {
                    setTimeout(() => syncWidgetFrame(attempt + 1), 50)
                }
                return
            }

            const target = moveable?.target
            const content = widgetRef.current

            if (!moveable || !target || !content || !target.contains(content)) {
                moveable?.updateRect?.()
                return
            }

            const currentWidth = getRenderedSize(target, 'width')
            const currentHeight = getRenderedSize(target, 'height')
            const currentBox = getCurrentWidgetBox(target, widgetManager.getWidgetConfig(id))
            const measuredSize = measureUnconstrainedContent(target, content)

            if (!measuredSize) {
                moveable.updateRect()
                return
            }

            const {width, height} = measuredSize
            const sizeChanged = Math.abs(currentWidth - width) > 0.5 || Math.abs(currentHeight - height) > 0.5
            const centerX = currentBox.left + (currentBox.width / 2)
            const centerY = currentBox.top + (currentBox.height / 2)
            const nextLeft = centerX - (width / 2)
            const nextTop = centerY - (height / 2)

            target.style.width = `${width}px`
            target.style.height = `${height}px`
            target.style.left = `${nextLeft}px`
            target.style.top = `${nextTop}px`

            if (sizeChanged) {
                const config = widgetManager.getWidgetConfig(id)
                if (config) {
                    config.dimensions = {width, height}
                    config.position = {left: nextLeft, top: nextTop}
                    if (config.persist && config.runtimeReady) {
                        void widgetManager.saveWidgetPosition(id, config)
                    }
                }

                if (lgs.stores?.ui?.widget?.list?.set) {
                    const widgetEntry = lgs.stores.ui.widget.list.get(id) ?? {}
                    lgs.stores.ui.widget.list.set(id, {
                        ...widgetEntry,
                        dimensions: {width, height},
                        position:   {left: nextLeft, top: nextTop},
                    })
                }
            }

            moveable.updateRect()
            requestAnimationFrame(() => moveable.updateRect())
        })
    }, [id])

    useEffect(() => {
        let isMounted = true

        if (!journeySlug || !journey || !element?.location || !__.ui.geocoder?.getJourneyLocation) {
            return () => {
                isMounted = false
            }
        }

        __.ui.geocoder.getJourneyLocation(journey)
            .then(location => {
                if (isMounted) {
                    setJourneyLocationState({slug: journeySlug, value: location})
                }
            })
            .catch(error => {
                console.error(error)
                if (isMounted) {
                    setJourneyLocationState({slug: journeySlug, value: ''})
                }
            })

        return () => {
            isMounted = false
        }
    }, [journey, journeySlug, element?.location])

    /**
     * Synchronize Moveable rect when visual elements toggle
     */
    useEffect(() => {
        if (!widgetRef.current || typeof ResizeObserver === 'undefined') {
            syncWidgetFrame()
            return
        }

        const observer = new ResizeObserver(syncWidgetFrame)
        observer.observe(widgetRef.current)
        syncWidgetFrame()

        return () => observer.disconnect()
    }, [syncWidgetFrame])

    /**
     * Synchronize Moveable rect when visual elements toggle
     */
    useEffect(() => {
        syncWidgetFrame()
    }, [
        syncWidgetFrame,
        journeySlug,
        journeyLocation,
        element?.date,
        element?.location,
        element?.altitude,
        element?.performance,
        element?.distance,
        element?.elevation,
        element?.duration,
        element?.summaryBreaks,
        element.separator,
        element.border,
        element.padding,
        textOrder,
        visibleTextGroups,
    ])

    const mainStyle = useMemo(() => {
        const textShadowColor = __.ui.ui.resolveItemColor(element.text?.shadow, true)
        const borderCorrection = element.border?.scaled === false ? scaleCorrection : 1
        const radiusCorrection = element.border?.radiusScaled === false ? scaleCorrection : 1
        const shadowSizes = {
            small:  [0, 1, 2],
            normal: [0, 2, 4],
            large:  [0, 4, 8],
        }
        const radius = WIDGET_RADIUS.get(element.border?.radius ?? 'none')?.value ?? '0'
        const shadowSize = shadowSizes[element.text?.shadow?.value] ?? shadowSizes.normal

        return {
            ...style,
            color:          __.ui.ui.resolveItemColor(element.text, true),
            textShadow:     element.text?.shadow?.show ? (
                `${shadowSize[0]}px ${shadowSize[1]}px ${shadowSize[2]}px ${textShadowColor}`
            ) : undefined,
            border:         element.border.show ? `${scaleValue(element.border.thickness, borderCorrection)}px solid ${__.ui.ui.resolveItemColor(element.border, true)}` : 'none',
            padding:        resolvePadding(element, scaleCorrection),
            background:     __.ui.ui.resolveItemColor(element.background, true),
            backdropFilter: (element.background?.show && element.background?.blur)
                            ? 'blur(var(--lgs-blur-s))'
                            : 'blur(0)',
            borderRadius:   element.border?.show ? scaleRadius(radius, radiusCorrection) : '0',
        }
    }, [element, scaleCorrection, style])

    const separatorStyle = useMemo(() => {
        const padding = Number(element.separator?.padding ?? 0)
        const spacing = Number.isFinite(padding) && padding > 0
                        ? `calc(var(--lgs-gutter-xs) + ${padding}px)`
                        : 'var(--lgs-gutter-xs)'

        return {
            '--color':   __.ui.ui.resolveItemColor(element.separator, true),
            '--spacing': spacing,
            'display':  element.separator?.show ? 'block' : 'none',
        }
    }, [element.separator])

    const renderTextItem = (itemId) => {
        switch (itemId) {
            case 'date':
                return (
                    <DateTimeDisplay className="journey-stats-date" items={date.items} forceStack key="date"/>
                )
            case 'location':
                return (
                    <div className="journey-stats-date journey-stats-location" key="location">
                        <span>{journeyLocation}</span>
                    </div>
                )
            case 'distance':
                return (
                    <div className="journey-stats-summary-item track-summary-column" key="distance">
                        <div className="journey-stats-val-huge">
                            <NameValueUnit value={displayMetrics.distance} units={DISTANCE_UNITS} noUnit/>
                        </div>
                        <div className="journey-stats-label-bold">{`Distance (${units.distance})`}</div>
                    </div>
                )
            case 'elevation':
                return (
                    <div className="journey-stats-summary-item track-summary-column" key="elevation">
                        <div className="journey-stats-val-huge">
                            <NameValueUnit value={displayMetrics.positive.elevation} units={ELEVATION_UNITS} noUnit
                                           precision="0"/>
                        </div>
                        <div className="journey-stats-label-bold">{`Elevation (${units.elevation})`}</div>
                    </div>
                )
            case 'duration':
                return (
                    <div className="journey-stats-summary-item track-summary-column" key="duration">
                        <div className="journey-stats-val-huge">{formattedDuration}</div>
                        <div className="journey-stats-label-bold">{'DURATION'}</div>
                    </div>
                )
            case 'altitude':
                return (
                    <div className="journey-stats-row" key="altitude">
                        <div className="journey-stats-label">{'Altitude'}<span>{`(${units.elevation})`}</span></div>
                        <div className="journey-stats-value">
                            {displayMetrics.minHeight > 0 &&
                                <>
                                    <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowDownToLine)}/>
                                    <NameValueUnit value={displayMetrics.minHeight} units={ELEVATION_UNITS} noUnit
                                                   precision="0"/>
                                </>
                            }
                        </div>
                        <div className="journey-stats-value">
                            {displayMetrics.maxHeight > 0 &&
                                <>
                                    <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                    <NameValueUnit value={displayMetrics.maxHeight} units={ELEVATION_UNITS} noUnit
                                                   precision="0"/>
                                </>
                            }
                        </div>
                    </div>
                )
            case 'speed':
                return (
                    <div className="journey-stats-row" key="speed">
                        <div className="journey-stats-label">{'Speed'}<span>{`(${units.speed})`}</span></div>
                        <div className="journey-stats-value">
                            {displayMetrics.averageSpeed > 0 &&
                                <NameValueUnit value={displayMetrics.averageSpeed} units={SPEED_UNITS} noUnit/>
                            }
                        </div>
                        <div className="journey-stats-value">
                            {displayMetrics.maxSpeed > 0 &&
                                <>
                                    <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                    <NameValueUnit value={displayMetrics.maxSpeed} units={SPEED_UNITS} noUnit/>
                                </>
                            }
                        </div>
                    </div>
                )
            case 'pace':
                return (
                    <div className="journey-stats-row" key="pace">
                        <div className="journey-stats-label">{'Pace'}<span>{`(${units.pace})`}</span></div>
                        <div className="journey-stats-value">
                            {paceValues.average && paceValues.average}
                        </div>
                        <div className="journey-stats-value">
                            {paceValues.min &&
                                <>
                                    <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                    {paceValues.min}
                                </>
                            }
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    const renderTextGroup = (group) => {
        if (group.group === 'meta') {
            return (
                <div className="journey-stats-meta">
                    {group.items.map(renderTextItem)}
                </div>
            )
        }

        if (group.group === 'summary') {
            const summaryClass = group.items.length > 1 ? 'journey-stats-row-center' : 'journey-stats-summary-stack'

            return (
                <div className={summaryClass}>
                    {group.items.map(renderTextItem)}
                </div>
            )
        }

        return group.items.map(renderTextItem)
    }

    const isVisible = useMemo(() => {
        if (!journeySlug || !journey) {
            return false
        }

        if (!isVideoBoard) {
            return true
        }

        return shouldShowVideoStatsWidget({mode, replay})
    }, [replay, isVideoBoard, journey, journeySlug, mode])

    const widgetStyle = useMemo(() => (
        isVisible
            ? mainStyle
            : {
                ...mainStyle,
                visibility: 'hidden',
                pointerEvents: 'none',
            }
    ), [isVisible, mainStyle])

    if (!journeySlug || !journey) {
        return null
    }

    return (
        <div ref={widgetRef} className="journey-stats-widget" style={widgetStyle} aria-hidden={!isVisible}>
            {visibleTextGroups.map((group, index) => (
                <Fragment key={`${group.group}-${group.items.join('-')}`}>
                    {index > 0 && <SlDivider style={separatorStyle}/>}
                    {renderTextGroup(group)}
                </Fragment>
            ))}
        </div>
    )
})
