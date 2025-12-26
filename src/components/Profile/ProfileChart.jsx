/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChart.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-26
 * Last modified: 2025-12-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './style.css'
import ReactECharts                                from 'echarts-for-react'
import * as echarts                                from 'echarts/core'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useSnapshot }                             from 'valtio'
import { CHART_ELEVATION_VS_DISTANCE, DISTANCE, ELEVATION } from '@Core/ui/Profiler'

/**
 * ProfileChart component to render elevation vs distance using ECharts
 * * @param {Object} props
 * @param {Object} props.data - Dataset and options for the chart
 * @param {Array} props.legends - Legend items
 * @returns {JSX.Element}
 */
export const ProfileChart = (props) => {
    const $main = lgs.mainProxy
    const mainSnap = useSnapshot($main)
    const _instance = useRef(null)

    /**
     * Build a single series object for ECharts
     */
    const buildSerie = useCallback((params) => {
        const rgbColor = __.ui.ui.hexToRGBA(params.color, 'rgb')
        const profileSettings = lgs.settings.profile

        return {
            name:       params.name,
            type:       'line',
            datasetId:  params.dataset,
            smooth:     true,
            encode:     {
                x: DISTANCE,
                y: ELEVATION,
            },
            showSymbol: false,
            symbolSize: profileSettings.marker.chart.size + profileSettings.marker.chart.border.width,
            emphasis:   {disabled: true},
            itemStyle: {
                color:       rgbColor,
                borderColor: profileSettings.marker.chart.border.color,
                borderWidth: profileSettings.marker.chart.border.width,
                opacity:     1,
            },
            lineStyle: {
                color:   rgbColor,
                width: profileSettings.line.width,
                opacity: 1,
            },
            areaStyle:  {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {offset: 0.5, color: __.ui.ui.RGB2RGBA(rgbColor, 0.5)},
                    {offset: 1, color: __.ui.ui.RGB2RGBA(rgbColor, 0.0)},
                ])
            },
            dimensions: params.dimensions,
        }
    }, [])

    /**
     * Compute chart options only when data or settings change
     */
    const chartOptions = useMemo(() => {
        if (!props.data) {
            return {}
        }

        const gutter = 15
        const series = props.data.dataset.map((_, index) => buildSerie({
                                                                           name:       props.data.options[index].name,
                                                                           dataset:    props.data.options[index].dataset,
                                                                           color:      props.data.options[index].color,
                                                                           dimensions: props.data.dimensions,
                                                                       }))

        const distances = props.data.dataset.map(ds => ({
            start: ds.source[0][0],
            end:   ds.source[ds.source.length - 1][0],
        }))

        const colors = props.data.options.map(opt => opt.color)

        return {
            toolbox:  {show: false},
            title:    {show: false},
            tooltip:  {
                trigger:            'axis',
                axisPointer:        {type: 'line'},
                formatter:          (params) => {
                    return __.ui.profiler.tooltipElevationVsDistance([
                                                                         params[0].seriesIndex,
                                                                         params[0].dataIndex,
                                                                         ...params[0].data,
                                                                         distances,
                                                                         colors,
                                                                     ])
                },
                padding:            0,
                enterable:          true,
                animationThreshold: 0,
            },
            legend:   {
                orient:       'horizontal',
                bottom:       0,
                data:         props.legends,
                selectedMode: false,
            },
            grid:     {
                top:          0.5 * gutter,
                left:         2 * gutter,
                right:        gutter,
                bottom:       2 * gutter,
                containLabel: true,
            },
            xAxis:    [
                {
                    type:        'value',
                    name:        props.data.axisNames.x ?? '',
                nameTextStyle: {
                    align:      'right',
                    verticalAlign: 'top',
                    fontWeight: 'bold',
                    padding:    [1.5 * gutter, 0, 0, 0],
                },
                    axisLabel:   {
                        alignMaxLabel: 'right',
                        showMaxLabel:  false,
                },
                    axisLine:    {onZero: false},
                    nameGap:     0,
                    minInterval: 5,
                    max:         'dataMax',
                }
            ],
            yAxis:    [
                {
                    type:         'value',
                    name:         props.data.axisNames.y ?? '',
                    nameRotate:   90,
                    nameLocation: 'end',
                nameTextStyle: {
                    align:      'right',
                    verticalAlign: 'bottom',
                    fontWeight: 'bold',
                    padding:    [0, 0, 3.5 * gutter, 0],
                },
                    minInterval:  5,
                    min:          (val) => Math.floor(val.min / 10) * 10,
                    splitNumber:  7,
                    nameGap:      0,
                }
            ],
            dataset:  props.data.dataset,
            series:   series,
            dataZoom: [{type: 'inside'}],
        }
    }, [props.data, props.legends, buildSerie])

    /**
     * Handle chart resizing
     */
    const handleResize = useCallback(() => {
        if (mainSnap.components.profile.show) {
            const container = document.getElementById(`profile-${CHART_ELEVATION_VS_DISTANCE}`)
            if (container) {
                const dimensions = container.getBoundingClientRect()
                if (dimensions.width > 0) {
                    $main.components.profile.width = dimensions.width
                    $main.components.profile.height = dimensions.height
                }
            }
        }
    }, [mainSnap.components.profile.show, $main])

    /**
     * Initialize chart instance and events
     */
    useEffect(() => {
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
    }, [handleResize, $main])

    const eventHandlers = {
        rendered: () => handleResize(),
    }

    if (!props.data) {
        return null
    }

    return (
        <ReactECharts
            option={chartOptions}
            style={{
                width:  mainSnap.components.profile.width,
                height: mainSnap.components.profile.height,
            }}
            opts={{renderer: 'svg'}}
            ref={_instance}
            onEvents={eventHandlers}
        />
    )
}