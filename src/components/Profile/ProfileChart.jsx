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
    buildFlythroughCompletedProfileSource,
    createFlythroughProfileDatasetLookup,
    flythroughProfileRowFromSample,
    flythroughSampleFromProfileRow,
} from '@Core/ui/flythrough/FlythroughProfileProgress'
import {
    normalizeFlythroughProfileInfo,
    normalizeFlythroughProgressionStyle,
} from '@Core/ui/flythrough/FlythroughProgressionStyle'
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

const toNumber = value => {
    const numeric = Number.parseFloat(value)
    return Number.isFinite(numeric) ? numeric : 0
}

const FLYTHROUGH_COMPLETED_DATASET_PREFIX = 'flythrough-completed:'
const FLYTHROUGH_COMPLETED_SERIES_PREFIX = 'flythrough-completed-series:'
const FLYTHROUGH_CURRENT_MARKER_SERIES = 'flythrough-current-marker'
const FLYTHROUGH_HOVER_MARKER_SERIES = 'flythrough-hover-marker'
const FLYTHROUGH_PROFILE_METRIC_GRAPHIC = 'flythrough-profile-metric-graphic'
const FLYTHROUGH_PROFILE_UPDATE_INTERVAL = 250

const completedDatasetId = datasetId => `${FLYTHROUGH_COMPLETED_DATASET_PREFIX}${datasetId}`
const completedSeriesId = datasetId => `${FLYTHROUGH_COMPLETED_SERIES_PREFIX}${datasetId}`
const isFlythroughSeries = seriesId => String(seriesId ?? '').startsWith('flythrough-')
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

    const _chart = useRef(null)
    const _chartDom = useRef(null)
    const _instance = useRef({
                                 getEchartsInstance: () => _chart.current,
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
    const flythroughDatasetLookups = useMemo(() =>
        processedDataset.map(dataset => createFlythroughProfileDatasetLookup(dataset, data?.dimensions)),
    [data?.dimensions, processedDataset])
    const hasAltitudeData = useMemo(() => {
        return processedDataset.some(dataset => Array.isArray(dataset.source) && dataset.source.length > 0)
    }, [processedDataset])

    /**
     * Build ECharts series object with optional gradient
     */
    const buildSerie = useCallback((params, config) => {
        const rgbColor = colord(params.color).toRgbString()

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

        return {
            name:       params.name,
            type:       'line',
            datasetId:  params.dataset,
            smooth:     true,
            encode:     {x: DISTANCE, y: ELEVATION},
            showSymbol: false,
            emphasis:   {disabled: true},
            lineStyle:  {color: rgbColor, width: 2, type: 'solid', opacity: 1},
            areaStyle: areaStyle,
            dimensions: params.dimensions,
        }
    }, [setColor])

    const buildFlythroughCompletedSerie = useCallback((params, config) => {
        const rgbColor = colord(params.color).toRgbString()
        const showGradient = config.gradient?.show ?? true
        const gradientColor = config.gradient?.color
                              ? colord(setColor(config.gradient)).toRgbString()
                              : rgbColor

        return {
            id:         completedSeriesId(params.dataset),
            name:       `${params.name} Flythrough`,
            type:       'line',
            datasetId:  completedDatasetId(params.dataset),
            smooth:     true,
            encode:     {x: DISTANCE, y: ELEVATION},
            showSymbol: false,
            silent:     true,
            z:          4,
            emphasis:   {disabled: true},
            lineStyle:  {color: rgbColor, width: 2, type: 'solid', opacity: 0.85},
            areaStyle:  showGradient ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {offset: 0.2, color: __.ui.ui.RGB2RGBA(gradientColor, 0.78)},
                    {offset: 1, color: __.ui.ui.RGB2RGBA(gradientColor, 0.16)},
                ]),
            } : undefined,
            dimensions: params.dimensions,
        }
    }, [setColor])

    const flythroughMarkerStyle = useCallback(() => {
        const progression = normalizeFlythroughProgressionStyle(
            lgs.stores.ui?.mainUI?.flythrough?.progression ?? lgs.settings.ui?.flythrough?.progression,
        )

        return {
            color:       colord(progression.fill.color).alpha(progression.fill.opacity).toRgbString(),
            borderColor: colord(progression.border.color).alpha(progression.border.opacity).toRgbString(),
            borderWidth: Math.max(0, Math.min(6, progression.border.width * 2)),
        }
    }, [])

    const flythroughMarkerSerie = useCallback((id, z) => ({
        id,
        type:       'scatter',
        data:       [],
        encode:     {x: 0, y: 1},
        symbol:     'circle',
        symbolSize: id === FLYTHROUGH_HOVER_MARKER_SERIES ? 7 : 8,
        silent:     true,
        z,
        itemStyle:  flythroughMarkerStyle(),
        dimensions: [DISTANCE, ELEVATION, TIME, POINT],
    }), [flythroughMarkerStyle])

    const baseOptions = useMemo(() => {
        if (!data || !element || !hasAltitudeData) {
            return {}
        }

        const series = data.dataset.map((_, index) => buildSerie({
                                                                     name:       data.options[index].name,
                                                                     dataset:    data.options[index].dataset,
                                                                     color:      data.options[index].color,
                                                                     dimensions: data.dimensions,
                                                                 }, element))
        const completedDatasets = data.dataset.map(dataset => ({
            id:         completedDatasetId(dataset.id),
            dimensions: data.dimensions,
            source:     [],
        }))
        const completedSeries = data.dataset.map((_, index) => buildFlythroughCompletedSerie({
                                                                                                 name:       data.options[index].name,
                                                                                                 dataset:    data.options[index].dataset,
                                                                                                 color:      data.options[index].color,
                                                                                                 dimensions: data.dimensions,
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
            dataset:  [...processedDataset, ...completedDatasets],
            series:   [
                ...series,
                ...completedSeries,
                flythroughMarkerSerie(FLYTHROUGH_CURRENT_MARKER_SERIES, 12),
                flythroughMarkerSerie(FLYTHROUGH_HOVER_MARKER_SERIES, 13),
            ],
            dataZoom:  preview ? [] : [{type: 'inside'}],
        }
    }, [
        data,
        buildSerie,
        buildFlythroughCompletedSerie,
        element,
        flythroughMarkerSerie,
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

        return row ? [[row[0], row[1], null, sample]] : []
    }, [data?.dimensions, unitSystem])

    const metric = useCallback((value, units, options = {}) =>
        UnitUtils.formatMetric(value, {units, ...options}).full.trim(), [])

    const flythroughProfileInfoColor = useCallback(() => {
        const profileInfo = normalizeFlythroughProfileInfo(
            lgs.stores.ui?.mainUI?.flythrough?.profileInfo ?? lgs.settings.ui?.flythrough?.profileInfo,
        )

        return colord(profileInfo.color).toRgbString()
    }, [])

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
            return [{
                id:      FLYTHROUGH_PROFILE_METRIC_GRAPHIC,
                $action: 'remove',
            }]
        }

        const chartWidth = chart?.getWidth?.() ?? 0
        const chartHeight = chart?.getHeight?.() ?? 0
        const fontSize = Math.max(8, Math.min(12, Math.round(chartHeight * 0.075)))
        const font = `600 ${fontSize}px sans-serif`
        const color = flythroughProfileInfoColor()
        const iconHeight = fontSize
        const iconWidth = Math.round(iconHeight * ((faCaretLargeLeft.icon?.[0] ?? 256) / (faCaretLargeLeft.icon?.[1] ?? 512)))
        const gap = Math.max(4, Math.round(fontSize * 0.5))
        const availableWidth = Math.max(120, chartWidth - 12)
        const fullTextWidth = measureTextWidth(text, font)
        const canShowIcons = availableWidth >= ((iconWidth * 2) + (gap * 2) + Math.min(48, fullTextWidth))
        const iconsWidth = canShowIcons ? (iconWidth * 2) + (gap * 2) : 0
        const textWidth = Math.min(Math.max(0, availableWidth - iconsWidth), fullTextWidth)
        const groupWidth = Math.min(availableWidth, iconsWidth + textWidth)
        const left = Math.max(6, (chartWidth - groupWidth) / 2)
        const textLeft = canShowIcons ? iconWidth + gap : 0
        const rightLeft = textLeft + textWidth + gap
        const top = Math.max(4, chartHeight - fontSize - 18)
        const children = [
            {
                type:  'text',
                x:     textLeft,
                y:     0,
                style: {
                    text,
                    width:         textWidth,
                    overflow:      'truncate',
                    lineHeight:    fontSize + 2,
                    font,
                    fill:          color,
                    align:         'left',
                    verticalAlign: 'top',
                },
            },
        ]

        if (canShowIcons) {
            children.unshift({
                                 type:  'image',
                                 x:     0,
                                 y:     1,
                                 style: {
                                     image:  profileInfoIconSvg(faCaretLargeLeft, color),
                                     width:  iconWidth,
                                     height: iconHeight,
                                 },
                             })
            children.push({
                              type:  'image',
                              x:     rightLeft,
                              y:     1,
                              style: {
                                  image:  profileInfoIconSvg(faCaretLargeRight, color),
                                  width:  iconWidth,
                                  height: iconHeight,
                              },
                          })
        }

        return [{
            id:        FLYTHROUGH_PROFILE_METRIC_GRAPHIC,
            type:      'group',
            left,
            top,
            width:     groupWidth,
            height:    fontSize + 2,
            z:         30,
            $action:   'replace',
            silent:    true,
            children,
        }]
    }, [flythroughMetricText, flythroughProfileInfoColor])

    const flythroughProfileOption = useCallback((flythroughState, chart) => {
        if (!data?.dataset || !data?.dimensions) {
            return null
        }

        const activeSample = (flythroughState?.active || flythroughState?.paused || flythroughState?.playing)
                             ? flythroughState?.sample
                             : null
        const markerStyle = flythroughMarkerStyle()

        return {
            animation: false,
            dataset: data.dataset.map(dataset => ({
                id:         completedDatasetId(dataset.id),
                dimensions: data.dimensions,
                source:     buildFlythroughCompletedProfileSource({
                    dataset,
                    lookup:     flythroughDatasetLookups.find(lookup => lookup.dataset?.id === dataset.id),
                    dimensions: data.dimensions,
                    sample: activeSample,
                    unitSystem,
                }),
            })),
            series:  [
                {
                    id:        FLYTHROUGH_CURRENT_MARKER_SERIES,
                    data:      markerDataFromSample(activeSample),
                    itemStyle: markerStyle,
                },
                {
                    id:        FLYTHROUGH_HOVER_MARKER_SERIES,
                    data:      markerDataFromSample(flythroughState?.hoverSample),
                    itemStyle: markerStyle,
                },
            ],
            graphic: flythroughMetricGraphic(flythroughState?.hoverSample ?? activeSample, flythroughState, chart),
        }
    }, [
        data,
        flythroughDatasetLookups,
        flythroughMetricGraphic,
        flythroughMarkerStyle,
        markerDataFromSample,
        unitSystem,
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
                chart.resize()
            }
            catch {
                return
            }

            syncProfileDimensions()
        }
    }, [preview, syncProfileDimensions])

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
    }, [handleResize, preview])

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
        if (preview || !lgs.stores.ui?.mainUI?.flythrough) {
            return
        }

        let frame = null
        let timeout = null
        let lastUpdate = 0
        const flythroughStore = lgs.stores.ui.mainUI.flythrough
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
                chart.setOption(option, {lazyUpdate: true})
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

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            if (timeout !== null) {
                clearTimeout(timeout)
            }
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

        chart.setOption(baseOptions, {
            replaceMerge: ['dataset', 'series', 'xAxis', 'yAxis'],
            lazyUpdate:   preview,
        })

        if (!preview) {
            requestAnimationFrame(handleResize)
        }
    }, [baseOptions, element, data, preview, handleResize, hasAltitudeData])

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
