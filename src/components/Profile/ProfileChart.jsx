/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChart.jsx
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

import './style.css'
import { useWidgetScaleCorrection } from '@Components/MainUI/widgets/useWidgetScaleCorrection'
import {
    flythroughProfileRowFromSample,
    flythroughSampleFromProfileRow,
} from '@Core/ui/flythrough/FlythroughProfileProgress'
import {
    normalizeFlythroughProfileInfo,
    normalizeFlythroughProgressionStyle,
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
import { DISTANCE_UNITS, ELEVATION_UNITS, INTERNATIONAL, UnitUtils } from '@Utils/UnitUtils'
import { faCaretLargeLeft, faCaretLargeRight } from '@fortawesome/pro-solid-svg-icons'
import { colord }        from 'colord'
import * as echarts                                from 'echarts'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { subscribe, useSnapshot } from 'valtio'
import { usePreviewChartResize } from '@Components/MainUI/widgets/editor/usePreviewChartResize'
import { v4 as uuid } from 'uuid'

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
const FLYTHROUGH_PROFILE_OVERLAY_GRAPHIC = 'flythrough-profile-overlay-graphic'
const FLYTHROUGH_PROFILE_LABEL_LEFT_GRAPHIC = 'flythrough-profile-label-left-graphic'
const FLYTHROUGH_PROFILE_LABEL_TEXT_GRAPHIC = 'flythrough-profile-label-text-graphic'
const FLYTHROUGH_PROFILE_LABEL_RIGHT_GRAPHIC = 'flythrough-profile-label-right-graphic'
const FLYTHROUGH_PROFILE_UPDATE_INTERVAL = 33
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
const iconPathData = icon => icon?.icon?.[4] ?? ''
const profileInfoIconSvgCache = new Map()
const profileInfoIconSvg = (icon, color) => {
    const [width = 320, height = 512] = icon?.icon ?? []
    const path = iconPathData(icon)
    const cacheKey = `${width}:${height}:${color}:${path}`

    if (profileInfoIconSvgCache.has(cacheKey)) {
        return profileInfoIconSvgCache.get(cacheKey)
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="${color}" d="${path}"/></svg>`
    const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

    profileInfoIconSvgCache.set(cacheKey, dataUri)
    return dataUri
}
let textMeasureContext = null
const measureTextWidth = (text, font) => {
    if (typeof document === 'undefined') {
        return text.length * 7
    }

    textMeasureContext ??= document.createElement('canvas').getContext('2d')
    textMeasureContext.font = font
    return textMeasureContext.measureText(text).width
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
    flythroughProfileOverlayResetGraphic(),
    {
        id:        FLYTHROUGH_PROFILE_LABEL_LEFT_GRAPHIC,
        type:      'image',
        $action:   'replace',
        left:      0,
        top:       0,
        invisible: true,
        silent:    true,
        style:     {
            image:   profileInfoIconSvg(faCaretLargeLeft, '#000000'),
            width:   1,
            height:  1,
            opacity: 0,
        },
    },
    {
        id:        FLYTHROUGH_PROFILE_LABEL_TEXT_GRAPHIC,
        type:      'text',
        $action:   'replace',
        left:      0,
        top:       0,
        invisible: true,
        silent:    true,
        style:     {
            text:    '',
            width:   1,
            opacity: 0,
        },
    },
    {
        id:        FLYTHROUGH_PROFILE_LABEL_RIGHT_GRAPHIC,
        type:      'image',
        $action:   'replace',
        left:      0,
        top:       0,
        invisible: true,
        silent:    true,
        style:     {
            image:   profileInfoIconSvg(faCaretLargeRight, '#000000'),
            width:   1,
            height:  1,
            opacity: 0,
        },
    },
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
export const ProfileChart = ({data, id, configId, width, height, preview = false}) => {
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)
    const unitSystem = unitStore.current
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const flythroughProfileInfo = useMemo(
        () => normalizeFlythroughProfileInfo(flythroughSettings.profileInfo),
        [flythroughSettings.profileInfo],
    )

    const _chart = useRef(null)
    const _chartDom = useRef(null)
    const _instance = useRef({
                                 getEchartsInstance: () => _chart.current,
                             })
    const _flythroughProfileGraphics = useRef({
                                                  key:        null,
                                                  renderedKey: null,
                                                  geometries: [],
                                              })
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
    const hasAltitudeData = useMemo(() => {
        return processedDataset.some(dataset => Array.isArray(dataset.source) && dataset.source.length > 0)
    }, [processedDataset])

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
            animation: preview ? false : undefined,
            // tooltip:   preview ? {show: false} : {
            //     trigger:     'axis',
            //     axisPointer: {type: 'line'},
            //     formatter:   (params) => __.ui.profiler.tooltipElevationVsDistance([
            //                                                                            params[0].seriesIndex,
            // params[0].dataIndex, ...params[0].data, distances, unitSystem, ]), padding:     0, enterable:   true, },
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

    const clearFlythroughProfileGraphicsCache = useCallback(() => {
        _flythroughProfileGraphics.current = {
            key:        null,
            renderedKey: null,
            geometries: [],
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
                    const gradientColor = element.gradient?.color
                                          ? colord(setColor(element.gradient)).toRgbString()
                                          : rgbColor
                    const fill = (element.gradient?.show ?? true)
                                 ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                     {offset: 0.2, color: __.ui.ui.RGB2RGBA(gradientColor, 0.78)},
                                     {offset: 1, color: __.ui.ui.RGB2RGBA(gradientColor, 0.16)},
                                 ])
                                 : __.ui.ui.RGB2RGBA(rgbColor, 0.28)

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
            _flythroughProfileGraphics.current = {
                key:         cacheKey,
                renderedKey: null,
                geometries,
            }
        }

        const samplePixel = chartPixelFromSample(sample, chart)
        const clipRight = samplePixel?.[0] ?? gridRect.x
        const clipWidth = Math.max(0, Math.min(gridRect.width, clipRight - gridRect.x))

        const shouldReplaceChildren = _flythroughProfileGraphics.current.renderedKey !== cacheKey
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

        if (shouldReplaceChildren) {
            graphic.children = geometries.flatMap(geometry => [
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
                        smooth: 0.35,
                    },
                    style:   profileGraphicLineStyle(lineModel),
                })),
            ])
            _flythroughProfileGraphics.current.renderedKey = cacheKey
        }

        return graphic
    }, [
        chartPixelFromSample,
        data,
        element,
        flythroughProfileInfo.useTrackStyle,
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
                type:      'circle',
                $action:   'replace',
                invisible: true,
                silent:    true,
                shape:     {cx: 0, cy: 0, r: 0},
                style:     {opacity: 0},
            }
        }

        return {
            id,
            type:    'circle',
            $action: 'replace',
            silent:  true,
            z,
            shape:   {
                cx: pixel[0],
                cy: pixel[1],
                r:  (size ?? markerStyle.size) / 2,
            },
            style:   {
                fill:        markerStyle.color,
                stroke:      markerStyle.borderColor,
                lineWidth:   markerStyle.borderWidth,
                opacity:     1,
                shadowBlur:  0,
            },
        }
    }, [chartPixelFromSample, flythroughMarkerStyle])

    const metric = useCallback((value, units, options = {}) =>
        UnitUtils.formatMetric(value, {units, ...options}).full.trim(), [])

    const flythroughProfileInfoColor = useCallback(() => {
        return colord(flythroughProfileInfo.color).toRgbString()
    }, [flythroughProfileInfo.color])

    const flythroughMetricText = useCallback((sample, flythroughState) => {
        if (!sample) {
            return ''
        }

        const totalDistance = Number(flythroughState?.totalDistance) || 0
        const direction = Number(flythroughState?.direction) < 0 ? -1 : 1
        const coveredDistance = direction < 0
                                ? (sample.remainingDistance ?? Math.max(0, totalDistance - (sample.distanceFromStart ?? 0)))
                                : (sample.distanceFromStart ?? 0)
        const remainingDistance = Math.max(0, totalDistance - coveredDistance)
        const altitude = metric(sample.altitude ?? sample.height, ELEVATION_UNITS, {precision: 0})

        return `${metric(coveredDistance, DISTANCE_UNITS, {precision: 1})} | ${altitude} | ${metric(remainingDistance, DISTANCE_UNITS, {precision: 1})}`
    }, [metric])

    const flythroughMetricGraphic = useCallback((sample, flythroughState, chart) => {
        const text = flythroughMetricText(sample, flythroughState)
        if (!text) {
            return []
        }

        const {width: chartWidth, height: chartHeight} = readChartSize(chart, _chartDom.current)
        if (chartWidth <= 0 || chartHeight <= 0) {
            return []
        }

        const color = flythroughProfileInfoColor()
        const availableWidth = Math.max(24, chartWidth - 12)
        const minFontSize = 5
        const maxFontSize = Math.max(7, Math.min(10, Math.round(chartHeight * 0.055)))
        const iconAspectRatio = (faCaretLargeLeft.icon?.[0] ?? 256) / (faCaretLargeLeft.icon?.[1] ?? 512)
        const metricsFor = (fontSize, showIcons) => {
            const lineHeight = Math.ceil(fontSize * 1.2)
            const font = `${fontSize}px sans-serif`
            const textWidth = Math.ceil(measureTextWidth(text, font))
            const iconHeight = Math.ceil(fontSize * 1.05)
            const iconWidth = Math.ceil(iconHeight * iconAspectRatio)
            const gap = Math.max(3, Math.round(fontSize * 0.45))
            const iconsWidth = showIcons ? (iconWidth * 2) + (gap * 2) : 0

            return {
                fontSize,
                lineHeight,
                font,
                textWidth,
                iconHeight,
                iconWidth,
                gap,
                showIcons,
                groupWidth: iconsWidth + textWidth,
            }
        }

        let labelMetrics = null
        for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
            const candidate = metricsFor(fontSize, true)
            if (candidate.groupWidth <= availableWidth) {
                labelMetrics = candidate
                break
            }
        }

        if (!labelMetrics) {
            for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
                const candidate = metricsFor(fontSize, false)
                if (candidate.groupWidth <= availableWidth) {
                    labelMetrics = candidate
                    break
                }
            }
        }

        labelMetrics ??= metricsFor(minFontSize, false)

        const {
            font,
            lineHeight,
            textWidth,
            iconHeight,
            iconWidth,
            gap,
            showIcons,
            groupWidth,
        } = labelMetrics
        const left = Math.max(6, (chartWidth - groupWidth) / 2)
        const textLeft = showIcons ? iconWidth + gap : 0
        const rightLeft = textLeft + textWidth + gap
        const gridRect = readChartGridRect(chart)
        const axisY = Number.isFinite(gridRect?.y) && Number.isFinite(gridRect?.height)
                      ? gridRect.y + gridRect.height
                      : chartHeight - 22
        const top = Math.max(4, Math.min(chartHeight - lineHeight - 2, axisY - lineHeight - 3))
        const iconTop = top + Math.max(0, (lineHeight - iconHeight) / 2)
        const children = [
            {
                id:        FLYTHROUGH_PROFILE_LABEL_LEFT_GRAPHIC,
                type:      'image',
                $action:   'replace',
                left,
                top:       iconTop,
                invisible: !showIcons,
                silent:    true,
                z:         32,
                style:     {
                    image:   profileInfoIconSvg(faCaretLargeLeft, color),
                    width:   iconWidth,
                    height:  iconHeight,
                    opacity: showIcons ? 1 : 0,
                },
            },
            {
                id:      FLYTHROUGH_PROFILE_LABEL_TEXT_GRAPHIC,
                type:    'text',
                $action: 'replace',
                left:    left + textLeft,
                top,
                silent:  true,
                z:       32,
                style:   {
                    text,
                    width:         textWidth,
                    lineHeight,
                    font,
                    fill:          color,
                    align:         'left',
                    verticalAlign: 'top',
                },
            },
            {
                id:        FLYTHROUGH_PROFILE_LABEL_RIGHT_GRAPHIC,
                type:      'image',
                $action:   'replace',
                left:      left + rightLeft,
                top:       iconTop,
                invisible: !showIcons,
                silent:    true,
                z:         32,
                style:     {
                    image:   profileInfoIconSvg(faCaretLargeRight, color),
                    width:   iconWidth,
                    height:  iconHeight,
                    opacity: showIcons ? 1 : 0,
                },
            },
        ]

        return children
    }, [flythroughMetricText, flythroughProfileInfoColor])

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
        const hoverSample = flythroughState?.hoverSample
        const overlayGraphics = flythroughMetricGraphic(hoverSample ?? activeSample, flythroughState, chart)
        if (!activeSample) {
            _flythroughProfileGraphics.current.renderedKey = null
        }
        const graphics = activeSample
                         ? [
                             flythroughCompletedGraphics(activeSample, chart),
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

        const chart = echarts.getInstanceByDom(dom) ?? echarts.init(dom, null, {renderer: 'svg'})
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
        if (preview) {
            return
        }

        const chart = _instance.current?.getEchartsInstance?.()
        if (!chart) {
            return
        }

        chart.on('mousemove', handleFlythroughProfileHover)
        chart.on('globalout', handleFlythroughProfileLeave)

        return () => {
            chart.off('mousemove', handleFlythroughProfileHover)
            chart.off('globalout', handleFlythroughProfileLeave)
        }
    }, [handleFlythroughProfileHover, handleFlythroughProfileLeave, preview])

    useEffect(() => {
        if (preview || !lgs.stores.flythrough) {
            return
        }

        let frame = null
        let timeout = null
        let lastUpdate = 0
        const flythroughStore = lgs.stores.flythrough
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
                    lazyUpdate: false,
                    silent:     true,
                })
            })
        }
        const applyFlythroughProgress = () => {
            const now = performance.now()
            const elapsed = now - lastUpdate
            const shouldRenderNow = !flythroughStore.playing || lastUpdate === 0 || elapsed >= FLYTHROUGH_PROFILE_UPDATE_INTERVAL

            if (shouldRenderNow) {
                if (timeout !== null) {
                    clearTimeout(timeout)
                    timeout = null
                }
                renderFlythroughProgress()
                return
            }

            if (timeout === null) {
                timeout = setTimeout(renderFlythroughProgress, FLYTHROUGH_PROFILE_UPDATE_INTERVAL - elapsed)
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
    }, [flythroughProfileOption, preview])

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
            <div ref={_chartDom} className="echarts-for-react" style={{width: '100%', height: '100%'}}/>
        </div>
    )
}
