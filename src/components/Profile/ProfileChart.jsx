/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChart.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { useWidgetScaleCorrection } from '@Components/MainUI/widgets/useWidgetScaleCorrection'
import {
    buildFlythroughProfileMetricSummary,
    flythroughProfileDimensionIndexes,
    flythroughProfileRowFromSample,
    flythroughSampleFromProfileRow,
} from '@Core/ui/flythrough/FlythroughProfileProgress'
import {
    normalizeFlythroughProfileInfo,
    normalizeFlythroughProgressionStyle,
    normalizeFlythroughTrace,
} from '@Core/ui/flythrough/FlythroughProgressionStyle'
import {
    FLYTHROUGH_EVENT_END,
    FLYTHROUGH_EVENT_PAUSE,
    FLYTHROUGH_EVENT_RESUME,
    FLYTHROUGH_EVENT_START,
    FLYTHROUGH_EVENT_STOP,
    FLYTHROUGH_EVENT_UPDATE,
} from '@Core/ui/flythrough/FlythroughPlaybackController'
import { CHART_ELEVATION_VS_DISTANCE, DISTANCE, ELEVATION, POINT, TIME } from '@Core/ui/Profiler'
import { INTERNATIONAL } from '@Utils/UnitUtils'
import { colord }        from 'colord'
import * as echarts                                from 'echarts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribe, useSnapshot } from 'valtio'
import { usePreviewChartResize } from '@Components/MainUI/widgets/editor/usePreviewChartResize'
import { v4 as uuid } from 'uuid'
import { WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'

const scaleValue = (value, correction = 1) => {
    const numericValue = Number(value)
    const numericCorrection = Number(correction)

    if (!Number.isFinite(numericValue)) {
        return 0
    }

    return numericValue * (Number.isFinite(numericCorrection) ? numericCorrection : 1)
}

const resolvePadding = (element, correction = 1, fallback = 8) => {
    const padding = element?.padding ?? {}
    const paddingCorrection = (padding.scaled ?? false) === false ? correction : 1

    const getValue = side => scaleValue(padding[side] ?? fallback, paddingCorrection)

    return `${getValue('top')}px ${getValue('right')}px ${getValue('bottom')}px ${getValue('left')}px`
}

const readElementSize = (element) => {
    if (!element) {
        return {width: 0, height: 0}
    }

    const rect = element.getBoundingClientRect()
    const width = element.clientWidth || rect.width
    const height = element.clientHeight || rect.height

    return {
        width:  Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
    }
}

const readChartSize = (chart, fallbackElement = null) => {
    const chartDom = chart?.getDom?.() ?? fallbackElement
    const chartWidth = Number(chart?.getWidth?.())
    const chartHeight = Number(chart?.getHeight?.())
    const domSize = readElementSize(chartDom)
    const parentSize = readElementSize(chartDom?.parentElement)

    return {
        width:  chartWidth > 0 ? chartWidth : domSize.width || parentSize.width,
        height: chartHeight > 0 ? chartHeight : domSize.height || parentSize.height,
    }
}

const readChartGridRect = (chart) => {
    try {
        return chart?.getModel?.()?.getComponent?.('grid', 0)?.coordinateSystem?.getRect?.() ?? null
    }
    catch {
        return null
    }
}

const readChartAxisExtent = (chart, axis) => {
    try {
        const extent = chart?.getModel?.()?.getComponent?.(axis, 0)?.axis?.scale?.getExtent?.()
        return Array.isArray(extent) ? extent.join(':') : ''
    }
    catch {
        return ''
    }
}

const toNumber = value => {
    const numeric = Number.parseFloat(value)
    return Number.isFinite(numeric) ? numeric : 0
}

const FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC = 'flythrough-profile-completed-graphic'
const FLYTHROUGH_PROFILE_CURRENT_MARKER_GRAPHIC = 'flythrough-profile-current-marker-graphic'
const FLYTHROUGH_PROFILE_HOVER_MARKER_GRAPHIC = 'flythrough-profile-hover-marker-graphic'
const FLYTHROUGH_PROFILE_LOCKED_HORIZONTAL_GUIDE_GRAPHIC = 'flythrough-profile-locked-horizontal-guide-graphic'
const FLYTHROUGH_PROFILE_LOCKED_VERTICAL_GUIDE_GRAPHIC = 'flythrough-profile-locked-vertical-guide-graphic'
const FLYTHROUGH_PROFILE_OVERLAY_GRAPHIC = 'flythrough-profile-overlay-graphic'
const FLYTHROUGH_PROFILE_UPDATE_INTERVAL = 33
const FLYTHROUGH_PROFILE_VIDEO_UPDATE_INTERVAL = 120
const PROFILE_LINE_WIDTH = 2

const isFlythroughSeries = seriesId => String(seriesId ?? '').startsWith('flythrough-')
const isFiniteCoordinate = value => Number.isFinite(Number(value))
const finitePositive = (value, fallback) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}
const profileColor = (value, fallback = '#ff6a00') => {
    const color = colord(value ?? fallback)
    if (color.isValid()) {
        return color.toRgbString()
    }

    return colord(fallback).toRgbString()
}
const isVisibleProfileColor = value => {
    const color = colord(value ?? '')
    return color.isValid() && color.alpha() > 0
}
const profileLineModels = ({color, renderStyle, useTrackStyle}) => {
    const mainColor = profileColor(renderStyle?.color ?? color)
    const dash = renderStyle?.dash

    if (!useTrackStyle || dash?.enabled !== true) {
        return [{key: 'solid', color: mainColor, type: 'solid'}]
    }

    const dashLength = finitePositive(dash.dashLength, 16)
    const gapLength = finitePositive(dash.gapLength, 16)
    const models = [
        {
            key:   'dash',
            color: mainColor,
            type:  [dashLength, gapLength],
        },
    ]

    if (dash.biColor === true && isVisibleProfileColor(dash.gapColor)) {
        models.push({
                        key:   'gap',
                        color: profileColor(dash.gapColor),
                        type:  [0, dashLength, gapLength, 0],
                    })
    }

    return models
}
const profileSeriesLineStyle = model => ({
    color:      model.color,
    width:      PROFILE_LINE_WIDTH,
    type:       model.type,
    dashOffset: model.dashOffset ?? 0,
    cap:        'butt',
    opacity:    1,
})
const profileGraphicLineStyle = model => {
    const style = {
        stroke:    model.color,
        lineWidth: PROFILE_LINE_WIDTH,
        opacity:   0.85,
        fill:      null,
        lineCap:   'butt',
    }

    if (Array.isArray(model.type)) {
        style.lineDash = model.type
        style.lineDashOffset = model.dashOffset ?? 0
    }

    return style
}
const flythroughProfileOverlayResetGraphic = () => ({
    id:        FLYTHROUGH_PROFILE_OVERLAY_GRAPHIC,
    type:      'group',
    $action:   'replace',
    left:      0,
    top:       0,
    width:     0,
    height:    0,
    invisible: true,
    silent:    true,
    children:  [],
})

const flythroughProfileHiddenGraphics = () => [
    {
        id:        FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC,
        type:      'group',
        $action:   'replace',
        invisible: true,
        silent:    true,
        children:  [],
    },
    {
        id:        FLYTHROUGH_PROFILE_CURRENT_MARKER_GRAPHIC,
        type:      'circle',
        $action:   'replace',
        invisible: true,
        silent:    true,
        shape:     {cx: 0, cy: 0, r: 0},
        style:     {opacity: 0},
    },
    {
        id:        FLYTHROUGH_PROFILE_HOVER_MARKER_GRAPHIC,
        type:      'circle',
        $action:   'replace',
        invisible: true,
        silent:    true,
        shape:     {cx: 0, cy: 0, r: 0},
        style:     {opacity: 0},
    },
    {
        id:        FLYTHROUGH_PROFILE_LOCKED_HORIZONTAL_GUIDE_GRAPHIC,
        type:      'line',
        $action:   'replace',
        invisible: true,
        silent:    true,
        shape:     {x1: 0, y1: 0, x2: 0, y2: 0},
        style:     {opacity: 0},
    },
    {
        id:        FLYTHROUGH_PROFILE_LOCKED_VERTICAL_GUIDE_GRAPHIC,
        type:      'line',
        $action:   'replace',
        invisible: true,
        silent:    true,
        shape:     {x1: 0, y1: 0, x2: 0, y2: 0},
        style:     {opacity: 0},
    },
    flythroughProfileOverlayResetGraphic(),
]

/**
 * ProfileChart component to render elevation vs distance using ECharts
 * @param {Object} props
 * @param {Object} props.data - Dataset and options for the chart
 * @param {string} props.id - DOM ID for the chart container
 * @param {string} [props.configId] - Entity ID for widget configuration lookup
 * @param {number|string} props.width
 * @param {number|string} props.height
 * @param {boolean} props.preview
 * @returns {React.JSX.Element}
 */
export const ProfileChart = ({data, id, configId, width, height, preview = false, locked = false}) => {
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)
    const unitSystem = unitStore.current
    const video = useSnapshot(lgs.stores.ui.video)
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const flythroughProfileInfo = useMemo(
        () => normalizeFlythroughProfileInfo(flythroughSettings.profileInfo),
        [flythroughSettings.profileInfo],
    )
    const flythroughProgression = useMemo(
        () => normalizeFlythroughProgressionStyle(flythroughSettings.progression),
        [flythroughSettings.progression],
    )
    const profileSettings = useSnapshot(lgs.settings.ui.profile)
    const showFlythroughLiveData = profileSettings.noLiveData !== true
    const flythroughTrace = useMemo(
        () => normalizeFlythroughTrace(flythroughSettings.trace),
        [flythroughSettings.trace],
    )

    const _chart = useRef(null)
    const _chartDom = useRef(null)
    const _profileMetricBadge = useRef(null)
    const _instance = useRef({
                                 getEchartsInstance: () => _chart.current,
                             })
    const _flythroughProfileGraphics = useRef({
                                                  key:        null,
                                                  renderedKey: null,
                                                  geometries: [],
                                                  completedChildren: [],
                                                  remainingChildren: [],
                                              })
    const [lockedProfileSample, setLockedProfileSample] = useState(null)
    const configKey = configId ?? id
    const scaleCorrection = useWidgetScaleCorrection(preview ? null : id)

    const getChartContainer = useCallback(() => _chartDom.current?.parentElement ?? null, [])

    const getLiveLayoutContainer = useCallback(() => {
        const chartContainer = getChartContainer()
        if (preview) {
            return chartContainer
        }

        return chartContainer?.closest('.lgs-widget') ?? chartContainer
    }, [getChartContainer, preview])

    const syncProfileDimensions = useCallback(() => {
        if (preview) {
            return
        }

        const layoutContainer = getLiveLayoutContainer()
        const {width: nextWidth, height: nextHeight} = readElementSize(layoutContainer)
        const $profile = lgs.stores.main.components.profile

        if (nextWidth > 0 && Math.abs(toNumber($profile.width) - nextWidth) > 0.5) {
            $profile.width = nextWidth
        }

        if (nextHeight > 0 && Math.abs(toNumber($profile.height) - nextHeight) > 0.5) {
            $profile.height = nextHeight
        }
    }, [getLiveLayoutContainer, preview])

    /**
     * Resolves the element to use based on configuration priority
     */
    const element = useMemo(() => {
        return configuration.elements?.[configKey] ?? configuration.user ?? configuration.default
    }, [configuration, configKey])
    const borderCorrection = element?.border?.scaled === false ? scaleCorrection : 1
    const borderWidth = element?.border?.show ? scaleValue(element.border.thickness, borderCorrection) : 0
    const padding = resolvePadding(element, scaleCorrection)

    const labels = useMemo(() => ({
        distance:  unitSystem === INTERNATIONAL ? 'km' : 'mi',
        elevation: unitSystem === INTERNATIONAL ? 'm' : 'ft',
    }), [unitSystem])

    /**
     * Resolve color from string or CSS variable
     */
    const setColor = useCallback((item) => {
        if (!item) {
            return 'transparent'
        }
        if (!item.color) {
            return 'transparent'
        }
        if (item.color.startsWith('--')) {
            return colord(__.ui.css.getCSSVariable(item.color)).alpha(item.opacity ?? 1).toRgbString()
        }

        return colord(item.color).alpha(item.opacity ?? 1).toRgbString()
    }, [])

    /**
     * Generate common grid and axis styles based on widget config
     */
    const getStyleOptions = useCallback((config) => {
        const mainColor = setColor(config.mainAxis)
        const mainCorrection = config.mainAxis?.scaled === false ? scaleCorrection : 1
        const secondCorrection = config.secondAxis?.scaled === false ? scaleCorrection : 1
        const mainWidth = scaleValue(config.mainAxis.thickness, mainCorrection)
        const secondColor = setColor(config.secondAxis)
        const secondWidth = scaleValue(config.secondAxis.thickness, secondCorrection)
        const mainFontSize = scaleValue(10, mainCorrection)

        return {
            grid:  {
                show:         config.xAxis.main || config.yAxis.main,
                borderColor:  mainColor,
                borderWidth:  mainWidth,
                top:          4,
                left:         4,
                right:        5,
                bottom:       4,
                containLabel: true,
            },
            xAxis: [
                {
                    axisTick:      {
                        show:      config.xAxis.labels,
                        lineStyle: {color: mainColor, width: mainWidth},
                    },
                    axisLine:      {
                        show:      config.xAxis.main,
                        lineStyle: {color: mainColor, width: mainWidth},
                    },
                    splitLine:     {
                        show:        config.xAxis.second,
                        showMinLine: !config.xAxis.main,
                        showMaxLine: !config.xAxis.main,
                        lineStyle:   {color: secondColor, width: secondWidth, type: 'dashed'},
                    },
                    axisLabel:     {
                        show:         config.xAxis.labels,
                        color:        mainColor,
                        showMinLabel: true,
                        showMaxLabel: !config.xAxis.units,
                        fontSize: mainFontSize,
                    },
                    name: config.xAxis.units ? labels.distance : '',
                    nameTextStyle: {
                        color:         mainColor,
                        align:         'right',
                        verticalAlign: 'top',
                        padding:       [6, 0, 0, 0],
                        fontSize: mainFontSize,
                    },
                },
            ],
            yAxis: [
                {
                    axisTick:      {
                        show:      config.yAxis.labels,
                        lineStyle: {color: mainColor, width: mainWidth},
                    },
                    axisLine:      {
                        show:      config.yAxis.main,
                        lineStyle: {color: mainColor, width: mainWidth},
                    },
                    splitLine:     {
                        show:        config.yAxis.second,
                        showMinLine: false,
                        showMaxLine: false,
                        lineStyle:   {color: secondColor, width: secondWidth, type: 'dashed'},
                    },
                    axisLabel:     {
                        show:         config.yAxis.labels,
                        color:        mainColor,
                        showMinLabel: true,
                        showMaxLabel: !config.yAxis.units,
                        formatter:    (value) => `${value}`,
                        fontSize: mainFontSize,
                    },
                    name: config.yAxis.units ? labels.elevation : '',
                    nameTextStyle: {
                        color:         mainColor,
                        align:         'right',
                        verticalAlign: 'middle',
                        padding:       [0, 10, 0, 0],
                        fontSize: mainFontSize,
                    },
                },
            ],
        }
    }, [setColor, labels, scaleCorrection])

    const processedDataset = useMemo(() => {
        if (!data?.dataset) {
            return []
        }
        return data.dataset
    }, [data])
    const profileTooltipMeta = useMemo(() => {
        const indexes = flythroughProfileDimensionIndexes(data?.dimensions)

        return {
            totalDistanceFromStart: processedDataset.reduce((last, dataset) => {
                const source = Array.isArray(dataset?.source) ? dataset.source : []
                const value = Number(source.at(-1)?.[indexes.distanceFromStart])
                return Number.isFinite(value) ? value : last
            }, 0),
        }
    }, [data, processedDataset])
    const hasAltitudeData = useMemo(() => {
        return processedDataset.some(dataset => Array.isArray(dataset.source) && dataset.source.length > 0)
    }, [processedDataset])
    const interactiveSeriesIndexes = useMemo(() => {
        const indexes = new Map()
        let seriesIndex = 0

        data?.dataset?.forEach((dataset, datasetIndex) => {
            const option = data?.options?.[datasetIndex]
            const lineModels = profileLineModels({
                color:         option?.color,
                renderStyle:   option?.renderStyle,
                useTrackStyle: flythroughProfileInfo.useTrackStyle,
            })

            if (dataset?.id && !indexes.has(dataset.id)) {
                indexes.set(dataset.id, seriesIndex)
            }

            seriesIndex += lineModels.length
        })

        return indexes
    }, [data?.dataset, data?.options, flythroughProfileInfo.useTrackStyle])
    /**
     * Build ECharts series object with optional gradient
     */
    const buildSerie = useCallback((params, config) => {
        const lineModels = profileLineModels({
                                                 color:         params.color,
                                                 renderStyle:   params.renderStyle,
                                                 useTrackStyle: flythroughProfileInfo.useTrackStyle,
                                             })
        const rgbColor = lineModels[0]?.color ?? profileColor(params.color)

        // Handle optional gradient show/hide and custom color
        const showGradient = config.gradient?.show ?? true
        const gradientColor = config.gradient?.color
                              ? colord(setColor(config.gradient)).toRgbString()
                              : rgbColor

        const areaStyle = showGradient ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {offset: 0.2, color: __.ui.ui.RGB2RGBA(gradientColor, 0.5)},
                {offset: 1, color: __.ui.ui.RGB2RGBA(gradientColor, 0.0)},
            ]),
        } : undefined

        return lineModels.map((lineModel, index) => ({
            id:              `${params.dataset}:profile:${lineModel.key}`,
            name:            params.name,
            type:            'line',
            datasetId:       params.dataset,
            smooth:          true,
            triggerLineEvent: true,
            encode:          {x: DISTANCE, y: ELEVATION},
            showSymbol:      false,
            emphasis:        {disabled: true},
            lineStyle:       profileSeriesLineStyle(lineModel),
            areaStyle:       index === 0 ? areaStyle : undefined,
            dimensions:      params.dimensions,
            silent:          index > 0,
            legendHoverLink: index === 0,
            z:               2 + index,
        }))
    }, [flythroughProfileInfo.useTrackStyle, setColor])

    const flythroughMarkerStyle = useCallback(() => {
        const progression = normalizeFlythroughProgressionStyle(
            lgs.stores.flythrough?.progression ?? lgs.settings.ui?.flythrough?.progression,
        )

        return {
            color:       colord(progression.fill.color).alpha(progression.fill.opacity).toRgbString(),
            borderColor: colord(progression.border.color).alpha(progression.border.opacity).toRgbString(),
            size:        progression.fill.profileMarker,
            borderWidth: progression.border.profileMarker,
        }
    }, [])

    const baseOptions = useMemo(() => {
        if (!data || !element || !hasAltitudeData) {
            return {}
        }

        const series = data.dataset.flatMap((_, index) => buildSerie({
                                                                         name:        data.options[index].name,
                                                                         dataset:     data.options[index].dataset,
                                                                         color:       data.options[index].color,
                                                                         renderStyle: data.options[index].renderStyle,
                                                                         dimensions:  data.dimensions,
                                                                     }, element))
        const styles = getStyleOptions(element)
        const yFloor = unitSystem === INTERNATIONAL ? 100 : 300
        const xCeiling = 1

        return {
            ...styles,
            toolbox:  {show: false},
            title:    {show: false},
            animation: false,
            animationDuration: 0,
            animationDurationUpdate: 0,
            tooltip: {show: false},
            xAxis:    [
                {
                    ...styles.xAxis[0],
                    type:         'value',
                    max: (val) => Math.ceil(val.max / xCeiling) * xCeiling,
                    splitNumber:  4,
                    onZero:       false,
                    nameLocation: 'end',
                    nameGap:      0,
                },
            ],
            yAxis:    [
                {
                    ...styles.yAxis[0],
                    type:         'value',
                    min: (val) => Math.floor(val.min / yFloor) * yFloor,
                    splitNumber:  4,
                    nameLocation: 'end',
                    nameGap:      -5,
                },
            ],
            dataset:  processedDataset,
            series:   [
                ...series,
            ],
            dataZoom:  preview ? [] : [{type: 'inside'}],
        }
    }, [
        data,
        buildSerie,
        element,
        getStyleOptions,
        unitSystem,
        processedDataset,
        preview,
        hasAltitudeData,
    ])

    const markerDataFromSample = useCallback((sample) => {
        const row = flythroughProfileRowFromSample(sample, {
            dimensions:     data?.dimensions,
            unitSystem,
            distanceLabel:  DISTANCE,
            elevationLabel: ELEVATION,
            timeLabel:      TIME,
            pointLabel:     POINT,
        })

        if (!row) {
            return []
        }

        const distanceIndex = data?.dimensions?.indexOf?.(DISTANCE) ?? 0
        const elevationIndex = data?.dimensions?.indexOf?.(ELEVATION) ?? 1
        const timeIndex = data?.dimensions?.indexOf?.(TIME) ?? 2
        const distance = row[distanceIndex >= 0 ? distanceIndex : 0]
        const elevation = row[elevationIndex >= 0 ? elevationIndex : 1]

        if (!isFiniteCoordinate(distance) || !isFiniteCoordinate(elevation)) {
            return []
        }

        return [[distance, elevation, row[timeIndex >= 0 ? timeIndex : 2] ?? null, sample]]
    }, [data?.dimensions, unitSystem])

    const chartPixelFromSample = useCallback((sample, chart) => {
        const row = markerDataFromSample(sample)?.[0]
        if (!row || !chart) {
            return null
        }

        try {
            const pixel = chart.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [row[0], row[1]])
            return Array.isArray(pixel) && isFiniteCoordinate(pixel[0]) && isFiniteCoordinate(pixel[1])
                   ? pixel
                   : null
        }
        catch {
            return null
        }
    }, [markerDataFromSample])

    const nearestProfilePointFromPixel = useCallback((event, chart) => {
        if (!chart || !Array.isArray(data?.dataset) || !Array.isArray(data?.dimensions)) {
            return null
        }

        const offsetX = Number(event?.offsetX)
        const offsetY = Number(event?.offsetY)
        if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
            return null
        }

        const gridRect = readChartGridRect(chart)
        if (!gridRect) {
            return null
        }

        if (offsetX < gridRect.x || offsetX > gridRect.x + gridRect.width || offsetY < gridRect.y || offsetY > gridRect.y + gridRect.height) {
            return null
        }

        const distanceIndex = data.dimensions.indexOf(DISTANCE)
        const elevationIndex = data.dimensions.indexOf(ELEVATION)
        if (distanceIndex < 0 || elevationIndex < 0) {
            return null
        }

        let nearest = null
        const sampler = __.ui.flythrough?.sampler ?? null

        data.dataset.forEach((dataset) => {
            const source = Array.isArray(dataset?.source) ? dataset.source : []
            const seriesIndex = interactiveSeriesIndexes.get(dataset?.id)
            if (!Number.isInteger(seriesIndex)) {
                return
            }

            source.forEach((row, dataIndex) => {
                const distance = row?.[distanceIndex]
                const elevation = row?.[elevationIndex]
                if (!isFiniteCoordinate(distance) || !isFiniteCoordinate(elevation)) {
                    return
                }

                try {
                    const pixel = chart.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [distance, elevation])
                    if (!Array.isArray(pixel) || !isFiniteCoordinate(pixel[0]) || !isFiniteCoordinate(pixel[1])) {
                        return
                    }

                    const delta = Math.hypot(pixel[0] - offsetX, pixel[1] - offsetY)
                    if (!nearest || delta < nearest.delta) {
                        nearest = {
                            seriesIndex,
                            dataIndex,
                            delta,
                            sample: flythroughSampleFromProfileRow(row, data.dimensions, sampler),
                        }
                    }
                }
                catch {

                }
            })
        })

        return nearest
    }, [data, interactiveSeriesIndexes])

    const clearFlythroughProfileGraphicsCache = useCallback(() => {
        _flythroughProfileGraphics.current = {
            key:               null,
            renderedKey:       null,
            geometries:        [],
            completedChildren: [],
            remainingChildren: [],
        }
    }, [])

    const profileTrackStyleKey = useMemo(() => JSON.stringify({
                                                                  useTrackStyle: flythroughProfileInfo.useTrackStyle,
                                                                  options:       data?.options?.map(option => ({
                                                                      color:       option?.color,
                                                                      renderStyle: option?.renderStyle,
                                                                  })),
                                                              }), [data?.options, flythroughProfileInfo.useTrackStyle])

    const flythroughCompletedGraphics = useCallback((sample, chart) => {
        const gridRect = readChartGridRect(chart)
        if (!sample || !chart || !gridRect || !data?.dimensions) {
            return {
                id:        FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC,
                type:      'group',
                $action:   'replace',
                invisible: true,
                silent:    true,
                children:  [],
            }
        }

        const {width: chartWidth, height: chartHeight} = readChartSize(chart, _chartDom.current)
        const cacheKey = [
            chartWidth,
            chartHeight,
            gridRect.x,
            gridRect.y,
            gridRect.width,
            gridRect.height,
            readChartAxisExtent(chart, 'xAxis'),
            readChartAxisExtent(chart, 'yAxis'),
            profileTrackStyleKey,
        ].join(':')
        let geometries = _flythroughProfileGraphics.current.geometries

        if (_flythroughProfileGraphics.current.key !== cacheKey) {
            const distanceIndex = data.dimensions.indexOf(DISTANCE)
            const elevationIndex = data.dimensions.indexOf(ELEVATION)
            const baseline = gridRect.y + gridRect.height

            geometries = processedDataset
                .map((dataset, index) => {
                    const source = Array.isArray(dataset?.source) ? dataset.source : []
                    const points = source
                        .map(row => {
                            const distance = row?.[distanceIndex]
                            const elevation = row?.[elevationIndex]
                            if (!isFiniteCoordinate(distance) || !isFiniteCoordinate(elevation)) {
                                return null
                            }

                            try {
                                const pixel = chart.convertToPixel(
                                    {xAxisIndex: 0, yAxisIndex: 0},
                                    [distance, elevation],
                                )
                                return Array.isArray(pixel)
                                    && isFiniteCoordinate(pixel[0])
                                    && isFiniteCoordinate(pixel[1])
                                       ? [pixel[0], pixel[1]]
                                       : null
                            }
                            catch {
                                return null
                            }
                        })
                        .filter(Boolean)

                    if (points.length < 2) {
                        return null
                    }

                    const option = data.options?.[index] ?? {}
                    const lineModels = profileLineModels({
                                                             color:         option.color,
                                                             renderStyle:   option.renderStyle,
                                                             useTrackStyle: flythroughProfileInfo.useTrackStyle,
                                                         })
                    const rgbColor = lineModels[0]?.color ?? profileColor(option.color)
                    const doneColor = profileColor(flythroughProgression.fill.color, rgbColor)
                    const gradientColor = element.gradient?.color
                                          ? colord(setColor(element.gradient)).toRgbString()
                                          : doneColor
                    const fill = (element.gradient?.show ?? true)
                                 ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                     {offset: 0.2, color: __.ui.ui.RGB2RGBA(gradientColor, 0.5)},
                                     {offset: 1, color: __.ui.ui.RGB2RGBA(gradientColor, 0.0)},
                                 ])
                                 : __.ui.ui.RGB2RGBA(gradientColor, 0.5)

                    return {
                        id:         dataset.id ?? option.dataset ?? index,
                        areaPoints: [
                            [points[0][0], baseline],
                            ...points,
                            [points[points.length - 1][0], baseline],
                        ],
                        linePoints: points,
                        fill,
                        lineModels,
                    }
                })
                .filter(Boolean)
        }

        const samplePixel = chartPixelFromSample(sample, chart)
        const clipRight = samplePixel?.[0] ?? gridRect.x
        const clipWidth = Math.max(0, Math.min(gridRect.width, clipRight - gridRect.x))
        const isFlythroughActive = Boolean(lgs.stores.flythrough?.active || lgs.stores.flythrough?.playing)
        const showRemainingOverlay = isFlythroughActive
                                     && flythroughTrace.remaining.useDefinedTrackStyle === false
                                     && flythroughTrace.mode === 'full'
        const remainingColor = profileColor(flythroughTrace.remaining.color, flythroughProgression.fill.color)
        const doneColor = profileColor(flythroughProgression.fill.color, flythroughProgression.fill.color)
        const overlayCacheKey = [
            cacheKey,
            doneColor,
            remainingColor,
            showRemainingOverlay ? '1' : '0',
        ].join(':')

        const shouldReplaceChildren = _flythroughProfileGraphics.current.renderedKey !== overlayCacheKey
        if (_flythroughProfileGraphics.current.key !== overlayCacheKey) {
            const completedChildren = geometries.flatMap(geometry => [
                {
                    id:      `${FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC}:${geometry.id}:area`,
                    type:    'polygon',
                    silent:  true,
                    z:       8,
                    shape:   {points: geometry.areaPoints},
                    style:   {
                        fill:    geometry.fill,
                        opacity: 1,
                    },
                },
                ...geometry.lineModels.map(lineModel => ({
                    id:      `${FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC}:${geometry.id}:line:${lineModel.key}`,
                    type:    'polyline',
                    silent:  true,
                    z:       9,
                    shape:   {
                        points: geometry.linePoints,
                        smooth:  0.35,
                    },
                    style:   {
                        ...profileGraphicLineStyle(lineModel),
                        stroke: doneColor,
                        opacity: 1,
                    },
                })),
            ])

            const remainingChildren = showRemainingOverlay
                                      ? geometries.flatMap(geometry => geometry.lineModels.map(lineModel => ({
                                          id:      `${FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC}:${geometry.id}:line:${lineModel.key}:remaining`,
                                          type:    'polyline',
                                          silent:  true,
                                          z:       7,
                                          shape:   {
                                              points: geometry.linePoints,
                                              smooth:  0.35,
                                          },
                                          style:   {
                                              ...profileGraphicLineStyle(lineModel),
                                              stroke:  remainingColor,
                                              opacity: 1,
                                          },
                                      })))
                                      : []

            _flythroughProfileGraphics.current = {
                key:               overlayCacheKey,
                renderedKey:       null,
                geometries,
                completedChildren,
                remainingChildren,
            }
        }

        const graphic = {
            id:       FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC,
            type:     'group',
            $action:  shouldReplaceChildren ? 'replace' : 'merge',
            silent:   true,
            z:        8,
            clipPath: {
                type:  'rect',
                shape: {
                    x:      gridRect.x,
                    y:      gridRect.y,
                    width:  clipWidth,
                    height: gridRect.height,
                },
            },
        }

        graphic.children = _flythroughProfileGraphics.current.completedChildren

        if (shouldReplaceChildren) {
            _flythroughProfileGraphics.current.renderedKey = overlayCacheKey
        }

        const remainingGraphic = showRemainingOverlay
                                 ? {
                                     id:      `${FLYTHROUGH_PROFILE_COMPLETED_GRAPHIC}:remaining`,
                                     type:    'group',
                                     $action: 'replace',
                                     silent:  true,
                                     z:       7,
                                     clipPath: {
                                         type:  'rect',
                                         shape: {
                                             x:      clipRight,
                                             y:      gridRect.y,
                                             width:  Math.max(0, gridRect.x + gridRect.width - clipRight),
                                             height: gridRect.height,
                                         },
                                     },
                                     children: _flythroughProfileGraphics.current.remainingChildren,
                                 }
                                 : null

        return remainingGraphic ? [graphic, remainingGraphic] : [graphic]
    }, [
        chartPixelFromSample,
        data,
        element,
        flythroughProfileInfo.useTrackStyle,
        flythroughProgression.fill.color,
        flythroughTrace.mode,
        flythroughTrace.remaining.color,
        flythroughTrace.remaining.useDefinedTrackStyle,
        processedDataset,
        profileTrackStyleKey,
        setColor,
    ])

    const flythroughMarkerGraphic = useCallback(({id, sample, chart, size, z}) => {
        const pixel = chartPixelFromSample(sample, chart)
        const markerStyle = flythroughMarkerStyle()
        if (!pixel) {
            return {
                id,
                type:      'group',
                $action:   'replace',
                invisible: true,
                silent:    true,
                children:  [],
            }
        }

        const diameter = Number.isFinite(Number(size)) ? Number(size) : markerStyle.size
        const borderWidth = Number.isFinite(Number(markerStyle.borderWidth)) ? Number(markerStyle.borderWidth) : 0
        const outerRadius = Math.max(0, diameter / 2)
        const innerRadius = Math.max(0, outerRadius - borderWidth)

        return {
            id,
            type:    'group',
            $action: 'replace',
            silent:  true,
            z,
            children: [
                {
                    id:      `${id}:border`,
                    type:    'circle',
                    silent:  true,
                    z:       z,
                    shape:   {
                        cx: pixel[0],
                        cy: pixel[1],
                        r:  outerRadius,
                    },
                    style:   {
                        fill:       markerStyle.borderColor,
                        opacity:    1,
                        shadowBlur: 0,
                    },
                },
                {
                    id:      `${id}:fill`,
                    type:    'circle',
                    silent:  true,
                    z:       z + 1,
                    shape:   {
                        cx: pixel[0],
                        cy: pixel[1],
                        r:  innerRadius,
                    },
                    style:   {
                        fill:       markerStyle.color,
                        opacity:    1,
                        shadowBlur: 0,
                    },
                },
            ],
        }
    }, [chartPixelFromSample, flythroughMarkerStyle])

    const lockedGuideGraphics = useCallback((sample, chart) => {
        const pixel = chartPixelFromSample(sample, chart)
        const gridRect = readChartGridRect(chart)
        const color = colord(flythroughMarkerStyle().color).alpha(0.7).toRgbString()

        if (!pixel || !gridRect) {
            return [
                {
                    id:        FLYTHROUGH_PROFILE_LOCKED_HORIZONTAL_GUIDE_GRAPHIC,
                    type:      'line',
                    $action:   'replace',
                    invisible: true,
                    silent:    true,
                    shape:     {x1: 0, y1: 0, x2: 0, y2: 0},
                    style:     {opacity: 0},
                },
                {
                    id:        FLYTHROUGH_PROFILE_LOCKED_VERTICAL_GUIDE_GRAPHIC,
                    type:      'line',
                    $action:   'replace',
                    invisible: true,
                    silent:    true,
                    shape:     {x1: 0, y1: 0, x2: 0, y2: 0},
                    style:     {opacity: 0},
                },
            ]
        }

        return [
            {
                id:      FLYTHROUGH_PROFILE_LOCKED_HORIZONTAL_GUIDE_GRAPHIC,
                type:    'line',
                $action: 'replace',
                silent:  true,
                z:       18,
                shape:   {
                    x1: gridRect.x,
                    y1: pixel[1],
                    x2: gridRect.x + gridRect.width,
                    y2: pixel[1],
                },
                style:   {
                    stroke:    color,
                    lineWidth: 1,
                    opacity:   1,
                },
            },
            {
                id:      FLYTHROUGH_PROFILE_LOCKED_VERTICAL_GUIDE_GRAPHIC,
                type:    'line',
                $action: 'replace',
                silent:  true,
                z:       18,
                shape:   {
                    x1: pixel[0],
                    y1: gridRect.y,
                    x2: pixel[0],
                    y2: gridRect.y + gridRect.height,
                },
                style:   {
                    stroke:    color,
                    lineWidth: 1,
                    opacity:   1,
                },
            },
        ]
    }, [chartPixelFromSample, flythroughMarkerStyle])

    const flythroughMetricLabel = useCallback((sample, flythroughState) => {
        const summary = buildFlythroughProfileMetricSummary(sample, {
            totalDistance:      Number(flythroughState?.totalDistance) || 0,
            direction:          flythroughState?.direction,
            unitSystem,
            distancePrecision:  1,
            elevationPrecision: 0,
        })

        if (!summary) {
            return null
        }

        return {
            covered:   summary.covered,
            altitude:  summary.altitudeLabel,
            remaining: summary.remaining,
        }
    }, [unitSystem])

    const hideProfileMetricBadge = useCallback(() => {
        _profileMetricBadge.current?.classList.add('profile-chart-metric-badge--hidden')
    }, [])

    const flythroughMetricGraphic = useCallback((sample, flythroughState, chart) => {
        if (!showFlythroughLiveData) {
            hideProfileMetricBadge()
            return []
        }

        const label = flythroughMetricLabel(sample, flythroughState)
        const badge = _profileMetricBadge.current
        if (!label) {
            badge?.classList.add('profile-chart-metric-badge--hidden')
            return []
        }

        const {width: chartWidth, height: chartHeight} = readChartSize(chart, _chartDom.current)
        if (chartWidth <= 0 || chartHeight <= 0) {
            badge?.classList.add('profile-chart-metric-badge--hidden')
            return []
        }

        const gridRect = readChartGridRect(chart)
        const axisY = Number.isFinite(gridRect?.y) && Number.isFinite(gridRect?.height)
                      ? gridRect.y + gridRect.height
                      : chartHeight - 22

        if (badge) {
            badge.querySelector('[data-profile-metric="covered"]').textContent = label.covered
            badge.querySelector('[data-profile-metric="altitude"]').textContent = label.altitude
            badge.querySelector('[data-profile-metric="remaining"]').textContent = label.remaining
            badge.classList.remove('profile-chart-metric-badge--hidden')

            const badgeWidth = badge.offsetWidth
            const badgeHeight = badge.offsetHeight
            const left = Math.max(6, Math.min(chartWidth - badgeWidth - 6, (chartWidth - badgeWidth) / 2))
            const top = Math.max(4, Math.min(chartHeight - badgeHeight - 2, axisY - badgeHeight - 3))

            badge.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`
        }

        return []
    }, [flythroughMetricLabel, hideProfileMetricBadge, showFlythroughLiveData])

    const flythroughProfileOption = useCallback((flythroughState, chart) => {
        if (!data?.dataset || !data?.dimensions) {
            return null
        }

        const visible = flythroughState?.active
            || flythroughState?.paused
            || flythroughState?.playing
            || flythroughState?.toolbarVisible
        const controllerSample = __.ui.flythrough?.controller?.currentSample?.()
        const activeSample = visible
                             ? (flythroughState?.playing ? (controllerSample ?? flythroughState?.sample) : (flythroughState?.sample ?? controllerSample))
                             : null
        const lockedSample = !activeSample && locked ? lockedProfileSample : null
        const displaySample = activeSample ?? lockedSample
        const hoverSample = flythroughState?.hoverSample
        const metricState = activeSample
                            ? flythroughState
                            : (lockedSample ? {
                                totalDistance: profileTooltipMeta.totalDistanceFromStart,
                                direction:     1,
                            } : null)
        const overlayGraphics = flythroughMetricGraphic(hoverSample ?? displaySample, metricState, chart)
        if (!activeSample) {
            _flythroughProfileGraphics.current.renderedKey = null
        }
        if (!displaySample || !showFlythroughLiveData) {
            hideProfileMetricBadge()
        }
        const graphics = activeSample
                         ? [
                             ...flythroughCompletedGraphics(activeSample, chart),
                             ...lockedGuideGraphics(activeSample, chart),
                             flythroughMarkerGraphic({
                                 id:     FLYTHROUGH_PROFILE_CURRENT_MARKER_GRAPHIC,
                                 sample: activeSample,
                                 chart,
                                 z:      20,
                             }),
                             flythroughMarkerGraphic({
                                 id:     FLYTHROUGH_PROFILE_HOVER_MARKER_GRAPHIC,
                                 sample: hoverSample,
                                 chart,
                                 z:      21,
                             }),
                             flythroughProfileOverlayResetGraphic(),
                             ...overlayGraphics,
                         ]
                         : lockedSample
                           ? [
                               ...lockedGuideGraphics(lockedSample, chart),
                               flythroughMarkerGraphic({
                                   id:     FLYTHROUGH_PROFILE_CURRENT_MARKER_GRAPHIC,
                                   sample: lockedSample,
                                   chart,
                                   z:      20,
                               }),
                               flythroughMarkerGraphic({
                                   id:        FLYTHROUGH_PROFILE_HOVER_MARKER_GRAPHIC,
                                   sample:    null,
                                   chart,
                                   z:         21,
                               }),
                               flythroughProfileOverlayResetGraphic(),
                               ...overlayGraphics,
                           ]
                         : flythroughProfileHiddenGraphics()

        return {
            animation: false,
            graphic: graphics,
        }
    }, [
        data,
        flythroughCompletedGraphics,
        flythroughMetricGraphic,
        flythroughMarkerGraphic,
        hideProfileMetricBadge,
        lockedGuideGraphics,
        locked,
        lockedProfileSample,
        profileTooltipMeta.totalDistanceFromStart,
                                                    showFlythroughLiveData,
    ])

    const handleFlythroughProfileHover = useCallback((params) => {
        if (preview || !data?.dimensions || params?.componentType !== 'series' || isFlythroughSeries(params.seriesId)) {
            return
        }

        const row = Array.isArray(params.data) ? params.data : null
        if (!row) {
            return
        }

        const sampler = __.ui.flythrough?.sampler ?? null
        const sample = flythroughSampleFromProfileRow(row, data.dimensions, sampler)
        if (!sample) {
            return
        }

        __.ui.flythrough?.handleProfileHover?.({sample})
    }, [data, preview])

    const handleFlythroughProfileLeave = useCallback(() => {
        if (!preview) {
            __.ui.flythrough?.handleProfileLeave?.()
        }
    }, [preview])

    const handleProfileBlankClick = useCallback((event) => {
        if (preview || !locked) {
            return
        }

        const chart = _instance.current?.getEchartsInstance?.()
        if (!chart) {
            return
        }

        const nearest = nearestProfilePointFromPixel(event, chart)
        if (nearest?.sample) {
            setLockedProfileSample(nearest.sample)
            void __.ui.profiler?.showSampleOnMap?.(nearest.sample)
            _chartDom.current?.focus?.()
            return
        }

        if (!event?.target) {
            setLockedProfileSample(null)
        }
    }, [locked, nearestProfilePointFromPixel, preview])

    useEffect(() => {
        if (preview || !locked || !lockedProfileSample || typeof document === 'undefined') {
            return
        }

        const handleDocumentPointerDown = (event) => {
            const chartElement = _chartDom.current
            const target = event.target

            if (!chartElement || !(target instanceof Node)) {
                return
            }

            if (chartElement === target || chartElement.contains(target)) {
                return
            }

            setLockedProfileSample(null)
        }

        document.addEventListener('pointerdown', handleDocumentPointerDown, true)
        return () => document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    }, [locked, lockedProfileSample, preview])

    useEffect(() => {
        clearFlythroughProfileGraphicsCache()
    }, [clearFlythroughProfileGraphicsCache, data, element, processedDataset, unitSystem])

    /**
     * Handle chart resizing and store state updates
     */
    const handleResize = useCallback(() => {
        if (preview) {
            return
        }
        const chart = _instance.current?.getEchartsInstance?.()
        if (chart) {
            try {
                clearFlythroughProfileGraphicsCache()
                chart.resize()
            }
            catch {
                return
            }

            syncProfileDimensions()
        }
    }, [clearFlythroughProfileGraphicsCache, preview, syncProfileDimensions])

    /**
     * Life cycle management: chart init, events and cleanup
     */
    useEffect(() => {
        const dom = _chartDom.current
        if (!dom) {
            return
        }

        const renderer = preview ? 'svg' : 'canvas'
        const chart = echarts.getInstanceByDom(dom) ?? echarts.init(dom, null, {renderer})
        _chart.current = chart

        let onDataZoom = null
        if (!preview) {
            __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, chart)
            onDataZoom = () => {
                clearFlythroughProfileGraphicsCache()
                lgs.stores.main.components.profile.zoom = true
            }
            chart.on('dataZoom', onDataZoom)
            window.addEventListener('resize', handleResize)
        }

        return () => {
            if (onDataZoom) {
                chart.off('dataZoom', onDataZoom)
            }
            window.removeEventListener('resize', handleResize)
            if (!preview && __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE) === chart) {
                __.ui.profiler.charts.delete(CHART_ELEVATION_VS_DISTANCE)
            }
            _chart.current = null
            chart.dispose()
        }
    }, [clearFlythroughProfileGraphicsCache, handleResize, preview])

    useEffect(() => {
        if (locked) {
            return
        }

        const frameId = requestAnimationFrame(() => {
            setLockedProfileSample(null)
            hideProfileMetricBadge()
        })
        return () => cancelAnimationFrame(frameId)
    }, [hideProfileMetricBadge, locked])

    useEffect(() => {
        if (preview || !locked) {
            return
        }

        const chart = _instance.current?.getEchartsInstance?.()
        const option = flythroughProfileOption(lgs.stores.flythrough ?? {}, chart)
        if (!chart || !option) {
            return
        }

        chart.setOption(option, {
            replaceMerge: ['graphic'],
            lazyUpdate:   true,
            silent:       true,
        })
    }, [flythroughProfileOption, locked, lockedProfileSample, preview])

    useEffect(() => {
        if (preview) {
            return
        }

        const chart = _instance.current?.getEchartsInstance?.()
        if (!chart) {
            return
        }
        const zr = chart.getZr?.()

        chart.on('mousemove', handleFlythroughProfileHover)
        chart.on('globalout', handleFlythroughProfileLeave)
        zr?.on?.('click', handleProfileBlankClick)

        return () => {
            chart.off('mousemove', handleFlythroughProfileHover)
            chart.off('globalout', handleFlythroughProfileLeave)
            zr?.off?.('click', handleProfileBlankClick)
        }
    }, [
        handleFlythroughProfileHover,
        handleFlythroughProfileLeave,
        handleProfileBlankClick,
        preview,
    ])

    useEffect(() => {
        if (preview || !lgs.stores.flythrough) {
            return
        }

        let frame = null
        let timeout = null
        let lastUpdate = 0
        const flythroughStore = lgs.stores.flythrough
        const videoCaptureActive = video.preRecording || video.recording || video.finalizing || video.snapshot
        const updateInterval = videoCaptureActive
                               ? FLYTHROUGH_PROFILE_VIDEO_UPDATE_INTERVAL
                               : FLYTHROUGH_PROFILE_UPDATE_INTERVAL
        const renderFlythroughProgress = () => {
            timeout = null
            if (frame !== null) {
                return
            }

            frame = requestAnimationFrame(() => {
                frame = null
                const chart = _instance.current?.getEchartsInstance?.()
                const option = flythroughProfileOption(flythroughStore, chart)
                if (!chart || !option) {
                    return
                }
                lastUpdate = performance.now()
                chart.setOption(option, {
                    replaceMerge: ['graphic'],
                    lazyUpdate:   true,
                    silent:       true,
                })
            })
        }
        const applyFlythroughProgress = () => {
            const now = performance.now()
            const elapsed = now - lastUpdate
            const shouldRenderNow = !flythroughStore.playing || lastUpdate === 0 || elapsed >= updateInterval

            if (shouldRenderNow) {
                if (timeout !== null) {
                    clearTimeout(timeout)
                    timeout = null
                }
                renderFlythroughProgress()
                return
            }

            if (timeout === null) {
                timeout = setTimeout(renderFlythroughProgress, updateInterval - elapsed)
            }
        }

        applyFlythroughProgress()
        const unsubscribe = subscribe(flythroughStore, applyFlythroughProgress)
        const flythroughController = __.ui.flythrough?.controller
        const controllerEvents = [
            FLYTHROUGH_EVENT_START,
            FLYTHROUGH_EVENT_UPDATE,
            FLYTHROUGH_EVENT_PAUSE,
            FLYTHROUGH_EVENT_RESUME,
            FLYTHROUGH_EVENT_STOP,
            FLYTHROUGH_EVENT_END,
        ]
        const unsubscribeController = flythroughController
                                      ? controllerEvents.map(event =>
                                          flythroughController.on(event, applyFlythroughProgress),
                                      )
                                      : []

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            if (timeout !== null) {
                clearTimeout(timeout)
            }
            unsubscribeController.forEach(unsubscribeEvent => unsubscribeEvent?.())
            unsubscribe()
        }
    }, [flythroughProfileOption, preview, video.preRecording, video.recording, video.finalizing, video.snapshot])

    usePreviewChartResize(_instance, preview, [width, height, padding, borderWidth])

    useEffect(() => {
        if (preview || !_chartDom.current || typeof ResizeObserver === 'undefined') {
            return
        }

        let frame = null
        const scheduleResize = () => {
            if (frame !== null) {
                return
            }

            frame = requestAnimationFrame(() => {
                frame = null
                handleResize()
            })
        }

        const observer = new ResizeObserver(scheduleResize)
        const chartDom = _chartDom.current
        const chartContainer = getChartContainer()
        const layoutContainer = getLiveLayoutContainer()

        observer.observe(chartDom)
        if (chartContainer) {
            observer.observe(chartContainer)
        }
        if (layoutContainer && layoutContainer !== chartContainer) {
            observer.observe(layoutContainer)
        }

        scheduleResize()

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            observer.disconnect()
        }
    }, [getChartContainer, getLiveLayoutContainer, handleResize, preview])

    /**
     * Synchronize ECharts options
     */
    useEffect(() => {
        const chart = _instance.current?.getEchartsInstance?.()
        if (!chart || !element || !data || !hasAltitudeData || !baseOptions) {
            return
        }

        clearFlythroughProfileGraphicsCache()
        chart.setOption(baseOptions, {
            replaceMerge: ['dataset', 'series', 'xAxis', 'yAxis'],
            lazyUpdate:   preview,
        })

        if (!preview) {
            requestAnimationFrame(handleResize)
        }
    }, [baseOptions, clearFlythroughProfileGraphicsCache, element, data, preview, handleResize, hasAltitudeData])

    if (!data || !element || !hasAltitudeData) {
        return null
    }

    return (
        <div id={id ?? `profile-${uuid()}`}
            className="profile-chart-container"
            style={{
                width:           width,
                height:          height,
                padding:         padding,
                backgroundColor: element.background.show ? setColor(element.background) : 'transparent',
                backdropFilter: element.background.blur ? 'blur(var(--lgs-blur-s))' : 'none',
                border:          element.border.show
                                 ? `${borderWidth}px solid ${setColor(element.border)}`
                                 : 'none',
                overflow:        'hidden',
            }}
        >
            <div
                ref={_chartDom}
                className="echarts-for-react"
                style={{width: '100%', height: '100%'}}
            />
            <div ref={_profileMetricBadge} className="profile-chart-metric-badge profile-chart-metric-badge--hidden">
                <span className="profile-chart-metric-badge__chevron" aria-hidden="true">
                    <WaIcon name="chevron-left" variant="solid"/>
                </span>
                <span className="profile-chart-metric-badge__value" data-profile-metric="covered"/>
                <span className="profile-chart-metric-badge__separator" aria-hidden="true"/>
                <span className="profile-chart-metric-badge__altitude">
                    <WaIcon name="mountains" variant="regular"/>
                    {'\u00a0'}
                    <span data-profile-metric="altitude"/>
                </span>
                <span className="profile-chart-metric-badge__separator" aria-hidden="true"/>
                <span className="profile-chart-metric-badge__value" data-profile-metric="remaining"/>
                <span className="profile-chart-metric-badge__chevron" aria-hidden="true">
                    <WaIcon name="chevron-right" variant="solid"/>
                </span>
            </div>
        </div>
    )
}
