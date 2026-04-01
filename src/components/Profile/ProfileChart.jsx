/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChart.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { CHART_ELEVATION_VS_DISTANCE, DISTANCE, ELEVATION } from '@Core/ui/Profiler'
import { INTERNATIONAL } from '@Utils/UnitUtils'
import { colord }        from 'colord'
import ReactECharts                                         from 'echarts-for-react'
import * as echarts                                         from 'echarts/core'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                      from 'valtio'
import { usePreviewChartResize } from '@Components/MainUI/widgets/editor/usePreviewChartResize'
import { v4 as uuid } from 'uuid'

/**
 * ProfileChart component to render elevation vs distance using ECharts
 * @param {Object} props
 * @param {Object} props.data - Dataset and options for the chart
 * @param {string} props.id - Entity ID for configuration lookup
 * @param {number|string} props.width
 * @param {number|string} props.height
 * @param {boolean} props.preview
 * @returns {React.JSX.Element}
 */
export const ProfileChart = ({data, id, width, height, preview = false}) => {
    const $main = lgs.stores.main
    const main = useSnapshot($main)
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)
    const unitSystem = unitStore.current

    const _instance = useRef(null)

    /**
     * Resolves the element to use based on configuration priority
     */
    const element = useMemo(() => {
        return configuration.elements?.[id] ?? configuration.user ?? configuration.default
    }, [configuration, id])

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
        const mainWidth = config.mainAxis.thickness
        const secondColor = setColor(config.secondAxis)
        const secondWidth = config.secondAxis.thickness

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
                        fontSize:     10,
                    },
                    name: config.xAxis.units ? labels.distance : '',
                    nameTextStyle: {
                        color:         mainColor,
                        align:         'right',
                        verticalAlign: 'top',
                        padding:       [6, 0, 0, 0],
                        fontSize:      10,
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
                        fontSize:     10,
                    },
                    name: config.yAxis.units ? labels.elevation : '',
                    nameTextStyle: {
                        color:         mainColor,
                        align:         'right',
                        verticalAlign: 'middle',
                        padding:       [0, 10, 0, 0],
                        fontSize:      10,
                    },
                },
            ],
        }
    }, [setColor, labels])

    const processedDataset = useMemo(() => {
        if (!data?.dataset) {
            return []
        }
        return data.dataset
    }, [data])

    /**
     * Build ECharts series object with optional gradient
     */
    const buildSerie = useCallback((params, config) => {
        const rgbColor = colord(params.color).toRgbString()

        // Handle optional gradient show/hide and custom color
        const showGradient = config.gradient?.show ?? true
        const gradientColor = config.gradient?.color
                              ? colord(config.gradient).toRgbString()
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
    }, [])

    const baseOptions = useMemo(() => {
        if (!data || !element) {
            return {}
        }

        const series = data.dataset.map((_, index) => buildSerie({
                                                                     name:       data.options[index].name,
                                                                     dataset:    data.options[index].dataset,
                                                                     color:      data.options[index].color,
                                                                     dimensions: data.dimensions,
                                                                 }, element))

        const distances = data.dataset.map(ds => ({
            start: ds.source[0][0],
            end:   ds.source[ds.source.length - 1][0],
        }))

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
            series:   series,
            dataZoom:  preview ? [] : [{type: 'inside'}],
        }
    }, [data, buildSerie, element, getStyleOptions, unitSystem, processedDataset, preview])

    /**
     * Handle chart resizing and store state updates
     */
    const handleResize = useCallback(() => {
        if (preview) {
            return
        }
        if (main.components.profile.show && _instance.current) {
            const chart = _instance.current.getEchartsInstance()
            chart.resize()

            const container = document.getElementById(`profile-${CHART_ELEVATION_VS_DISTANCE}`)
            if (container) {
                const dimensions = container.getBoundingClientRect()
                if (dimensions.width > 0) {
                    $main.components.profile.width = dimensions.width
                    $main.components.profile.height = dimensions.height
                }
            }
        }
    }, [preview, main.components.profile.show, $main])

    /**
     * Life cycle management: Instance registration, events and cleanup
     */
    useEffect(() => {
        if (!_instance.current || preview) {
            return
        }

        const chart = _instance.current.getEchartsInstance()
        __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, chart)

        const onDataZoom = () => {
            $main.components.profile.zoom = true
        }

        chart.on('dataZoom', onDataZoom)
        window.addEventListener('resize', handleResize)

        return () => {
            chart.off('dataZoom', onDataZoom)
            window.removeEventListener('resize', handleResize)
            __.ui.profiler.charts.delete(CHART_ELEVATION_VS_DISTANCE)
        }
    }, [handleResize, $main, preview])

    usePreviewChartResize(_instance, preview, [width, height])

    /**
     * Unit & Dataset Synchronization
     * Direct ECharts API call to update data without full re-merge
     */
    useEffect(() => {
        if (!_instance.current || !element || !data || !baseOptions) {
            return
        }

        const chart = _instance.current.getEchartsInstance()
        const yFloor = unitSystem === INTERNATIONAL ? 100 : 300
        const xCeiling = 1

        chart.setOption({
                            dataset: processedDataset,
                            series:  baseOptions.series,
                            xAxis: [
                                {
                                    ...baseOptions.xAxis[0],
                                    max: (val) => Math.ceil(val.max / xCeiling) * xCeiling,
                                },
                            ],
                            yAxis:   [
                                {
                                    ...baseOptions.yAxis[0],
                                    min: (val) => Math.floor(val.min / yFloor) * yFloor,
                                },
                            ],
                        }, {
                            replaceMerge: ['dataset', 'series', 'xAxis', 'yAxis'],
                            lazyUpdate:   false,
                        })

    }, [processedDataset, baseOptions, element, data, unitSystem])

    if (!data || !element) {
        return null
    }

    return (
        <div id={id ?? `profile-${uuid()}`}
            className="profile-chart-container"
            style={{
                width:           width,
                height:          height,
                backgroundColor: element.background.show ? setColor(element.background) : 'transparent',
                backdropFilter: element.background.blur ? 'blur(var(--lgs-blur-s))' : 'none',
                border:          element.border.show
                                 ? `${element.border.thickness}px solid ${setColor(element.border)}`
                                 : 'none',
                overflow:        'hidden',
            }}
        >
            <ReactECharts
                option={baseOptions}
                style={{width: '100%', height: '100%'}}
                opts={{renderer: 'svg'}}
                ref={_instance}
                onEvents={preview ? undefined : {rendered: handleResize}}
                notMerge={false}
                lazyUpdate={preview}
            />
        </div>
    )
}