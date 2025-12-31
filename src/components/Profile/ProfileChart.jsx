/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChart.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-31
 * Last modified: 2025-12-31
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './style.css'
import { CHART_ELEVATION_VS_DISTANCE, DISTANCE, ELEVATION } from '@Core/ui/Profiler'
import ReactECharts                                         from 'echarts-for-react'
import * as echarts                                         from 'echarts/core'
import { useCallback, useEffect, useMemo, useRef }          from 'react'
import { useSnapshot }                                      from 'valtio'

/**
 * ProfileChart component to render elevation vs distance using ECharts
 * * @param {Object} props
 * @param {Object} data - Dataset and options for the chart
 * @param id
 * @param width
 * @param height
 * @returns {React.JSX.Element}
 */
export const ProfileChart = ({data, id, width, height}) => {
    const $main = lgs.stores.main
    const main = useSnapshot($main)
    const configuration = lgs.settings.widgets['profile-widget'].configuration[id]

    const _instance = useRef(null)

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
            encode:     {
                x: DISTANCE,
                y: ELEVATION,
            },
            showSymbol: false,
            emphasis:   {disabled: true},
            // itemStyle: {
            //     color:       rgbColor,
            //     borderColor: profileSettings.marker.chart.border.color,
            //     borderWidth: profileSettings.marker.chart.border.width,
            //     opacity:     1,
            // },
            lineStyle:  {
                color:   rgbColor,
                width: 1,
                type:  'dashed',
                opacity: 1,
            },
            areaStyle:  {

                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {offset: 0.5, color: __.ui.ui.RGB2RGBA(rgbColor, 0.5)},
                    {offset: 1, color: __.ui.ui.RGB2RGBA(rgbColor, 0.0)},
                ]),
            },
            dimensions: params.dimensions,
        }
    }, [])

    /**
     * Compute chart options only when data or settings change
     */
    const chartOptions = useMemo(() => {
        if (!data) {
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

        const colors = data.options.map(opt => opt.color)
        const {max, interval} = __.ui.profiler.calculateNiceScale(Math.max(...distances, 3))
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
                                                                     ])
                },
                padding:            0,
                enterable:          true,
                animationThreshold: 0,
            },
            legend:   {
                orient:       'horizontal',
                bottom:       0,
                data: data.legends,
                selectedMode: false,
                show: true,
            },
            grid:     {
                top:          0.5 * lgs.gutter.n,
                left:         2 * lgs.gutter.n,
                right:        lgs.gutter.n,
                bottom:       2 * lgs.gutter.n,
                containLabel: false,
                show:         false,
            },
            xAxis:    [
                {
                    type:          'value',
                    name:          data.axisNames.x ?? '',
                    show:          true,
                    max:           max,
                    interval:      interval,
                    nameTextStyle: {
                        align:         'right',
                        verticalAlign: 'top',
                        fontWeight:    'bold',
                        padding:       [1.5 * lgs.gutter.n, 0, 0, 0],
                    },
                    axisLabel:     {
                        alignMaxLabel: 'right',
                        showMaxLabel:  false,
                    },
                    axisLine:      {onZero: false},
                    nameGap:       0,
                    minInterval:   3,
                    // max:         'dataMax',
                },
            ],
            yAxis:    [
                {
                    type:          'value',
                    nameRotate:    90,
                    nameLocation:  'end',
                    show:          true,
                    nameTextStyle: {
                        show:          false,
                        align:         'right',
                        verticalAlign: 'bottom',
                        fontWeight:    'bold',
                        padding:       [0, 0, 3.5 * lgs.gutter.n, 0],
                    },
                    minInterval:   3,
                    min:           (val) => Math.floor(val.min / 100) * 100,

                    splitNumber: 5,
                    nameGap:     0,
                },
            ],
            dataset:  data.dataset,
            series:   series,
            dataZoom: [{type: 'inside'}],
        }
    }, [data, buildSerie])

    /**
     * Handle chart resizing
     */
    const handleResize = useCallback(() => {
        if (main.components.profile.show) {
            const container = document.getElementById(`profile-${CHART_ELEVATION_VS_DISTANCE}`)
            if (container) {
                const dimensions = container.getBoundingClientRect()
                if (dimensions.width > 0) {
                    $main.components.profile.width = dimensions.width
                    $main.components.profile.height = dimensions.height
                }
            }
        }
    }, [main.components.profile.show, $main])

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

    if (!data) {
        return null
    }

    return (
        <div className="profile-chart-container">
            <ReactECharts
                option={chartOptions}
                notMerge={true}
                lazyUpdate={true}
                style={{
                    width:  width,
                    height: height,
                }}
                opts={{renderer: 'svg'}}
                ref={_instance}
                onEvents={eventHandlers}
            />
        </div>
    )
}