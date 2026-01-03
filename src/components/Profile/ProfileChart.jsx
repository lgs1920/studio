/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChart.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-03
 * Last modified: 2026-01-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { CHART_ELEVATION_VS_DISTANCE, DISTANCE, ELEVATION } from '@Core/ui/Profiler'
import { colord } from 'colord'
import ReactECharts                                         from 'echarts-for-react'
import * as echarts                                         from 'echarts/core'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                      from 'valtio'

/**
 * ProfileChart component to render elevation vs distance using ECharts
 * Uses Valtio for real-time style updates without full chart re-renders
 * @param {Object} props
 * @param {Object} props.data - Dataset and options for the chart
 * @param {string} props.id - Entity ID for configuration lookup
 * @param {number|string} props.width
 * @param {number|string} props.height
 * @returns {React.JSX.Element}
 */
export const ProfileChart = ({data, id, width, height}) => {
    const $main = lgs.stores.main
    const main = useSnapshot($main)
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)

    const element = configuration.elements?.[id]
    if (!element) {
        if (!$configuration.elements || typeof $configuration.elements !== 'object') {
            $configuration.elements = {}
        }
        const defaultValue = $configuration.user ?? $configuration.default
        $configuration.elements[id] = defaultValue
    }

    const _instance = useRef(null)

    /**
     * Helper to convert hex + opacity to rgba string
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
     * Centralized style generator to avoid code duplication
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
                    name:          config.xAxis.units ? (data?.axisNames?.x ?? '') : '',
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
                    name:          config.yAxis.units ? (data?.axisNames?.y ?? '') : '',
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
    }, [data, setColor])

    /**
     * Build a single series object for ECharts
     */
    const buildSerie = useCallback((params) => {
        const rgbColor = __.ui.ui.hexToRGBA(params.color, 'rgb')
        return {
            name:       params.name,
            type:       'line',
            datasetId:  params.dataset,
            smooth:     true,
            encode:     {x: DISTANCE, y: ELEVATION},
            showSymbol: false,
            emphasis:   {disabled: true},
            lineStyle:  {color: rgbColor, width: 2, type: 'solid', opacity: 1},
            areaStyle:  {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {offset: 0.2, color: __.ui.ui.RGB2RGBA(rgbColor, 0.5)},
                    {offset: 1, color: __.ui.ui.RGB2RGBA(rgbColor, 0.0)},
                ]),
            },
            dimensions: params.dimensions,
        }
    }, [])

    /**
     * Compute static chart options (Data and Structure)
     */
    const baseOptions = useMemo(() => {
        if (!data || !element) {
            return {}
        }

        const series = data.dataset.map((_, index) => buildSerie({
                                                                     name:       data.options[index].name,
                                                                     dataset:    data.options[index].dataset,
                                                                     color:      data.options[index].color,
                                                                     dimensions: data.dimensions,
                                                                 }))

        const distances = data.dataset.map(ds => ({
            start: ds.source[0][0],
            end:   ds.source[ds.source.length - 1][0],
        }))

        const styles = getStyleOptions(element)

        return {
            ...styles,
            toolbox:  {show: false},
            title:    {show: false},
            tooltip:  {
                trigger:     'axis',
                axisPointer: {type: 'line'},
                formatter:   (params) => __.ui.profiler.tooltipElevationVsDistance([
                                                                                       params[0].seriesIndex, params[0].dataIndex, ...params[0].data, distances,
                                                                                   ]),
                padding:     0,
                enterable:   true,
            },
            legend:   {
                orient:       'horizontal',
                bottom:       0,
                data: data.legends,
                selectedMode: false,
                show:         false,
            },
            xAxis:    [
                {
                    ...styles.xAxis[0],
                    type:         'value',
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
                    min:          (val) => Math.floor(val.min / 100) * 100,
                    splitNumber:  4,
                    nameLocation: 'end',
                    nameGap:      -5,
                },
            ],
            dataset:  data.dataset,
            series:   series,
            dataZoom: [{type: 'inside'}],
        }
    }, [data, buildSerie, element, getStyleOptions])

    /**
     * DYNAMIC STYLE INJECTION
     */
    useEffect(() => {
        if (!_instance.current || !element) {
            return
        }
        const chart = _instance.current.getEchartsInstance()
        chart.setOption(getStyleOptions(element))
    }, [element, getStyleOptions, id])

    /**
     * Handle chart resizing
     */
    const handleResize = useCallback(() => {
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
    }, [main.components.profile.show, $main, id])

    /**
     * Initialize chart instance and events
     */
    useEffect(() => {
        if (!_instance.current) {
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
        }
    }, [handleResize, $main, id])

    /**
     * Diagnostic: Specific Early Exit check
     */
    if (!data || !element) {
        console.warn(`[ProfileChart:${id}] Stopping render:`, {
            missingData:    !data,
            missingElement: !element,
        })
        return null
    }

    return (
        <div
            className="profile-chart-container"
            style={{
                width:           width,
                height:          height,
                backgroundColor: element.background.show ? setColor(element.background) : 'transparent',
                backdropFilter:  element.background.blur ? 'blur(10px)' : 'none',
                border:          element.border.show
                                 ? `${element.border.thickness}px solid ${setColor(element.border)}`
                                 : 'none',
                overflow:        'hidden',
            }}
        >
            <ReactECharts
                option={baseOptions}
                notMerge={false}
                lazyUpdate={true}
                style={{width: '100%', height: '100%'}}
                opts={{renderer: 'svg'}}
                ref={_instance}
                onEvents={{rendered: handleResize}}
            />
        </div>
    )
}