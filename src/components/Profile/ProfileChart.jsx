import './style.css'

import ReactECharts                                         from 'echarts-for-react'
import * as echarts                                         from 'echarts/core'
import { useEffect, useRef }                                from 'react'
import { useSnapshot }                                      from 'valtio'
import { CHART_ELEVATION_VS_DISTANCE, DISTANCE, ELEVATION } from '../../core/ui/Profiler'

/**
 *
 * @param props
 *
 * props
 * @return {JSX.Element}
 * @constructor
 */
export const ProfileChart = (props) => {

    const getMax = (name) => {
        const index = props.data.dimensions.indexOf(name)
        return props.data.dataset.map(dataset => {
            return Math.max(...dataset.source.map(row => row[index]))
        })
    }
    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)
    const instance = useRef(null)


    /**
     * Dans le dataset, rajouter time si existe t dans ce cas créer un second axis
     * TODO : rajouter toutes les info nécessaires au tooltip dans un objet point
     * */

    /**
     *
     * @param params name     : title
     *               dataset  : datasetId
     *               color    : color in hex format
     */
    const buildSerie = (params) => {
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
            symbolSize: lgs.settings.getProfile.marker.chart.size         // we need it fo tooltip
                            + lgs.settings.getProfile.marker.chart.border.width,

            emphasis:  {disabled: true},
            itemStyle: {
                color:       rgbColor,
                borderColor: lgs.settings.getProfile.marker.chart.border.color,
                borderWidth: lgs.settings.getProfile.marker.chart.border.width,
                opacity:     1,
            },

            lineStyle: {
                color:   rgbColor,
                width: lgs.settings.getProfile.line.width,
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
    }

    const gutter = 15 // lgs-gutter 1rem

    const series = []
    props.data.dataset.forEach((dataset, index) => {
        series.push(buildSerie({
                                   name:       props.data.options[index].name,
                                   dataset:    props.data.options[index].dataset,
                                   color:      props.data.options[index].color,
                                   dimensions: props.data.dimensions,
                               }),
        )
    })

    // We need distance information for each serie
    const distances = props.data.dataset.map(dataset => {
        return {
            start: dataset.source[0][0],
            end:   dataset.source[dataset.source.length - 1][0],
        }
    })
    // We need color for each serie
    const colors = props.data.options.map(option => {
        return option.color
    })


    const option = {
        toolbox: {
            show: false,
        },
        title:   {
            show: false,
        },
        tooltip: {
            trigger:            'axis',
            axisPointer:        {
                type: 'line',
            },
            formatter:          (params) => {
                // We need to get the last point to compute remaining distance
                const data = params[0].data
                return __.ui.profiler.tooltipElevationVsDistance(
                    [
                        ...[
                            params[0].seriesIndex,
                            params[0].dataIndex,
                        ],
                        ...params[0].data,
                        ...[distances],
                        ...[colors],
                    ],
                )
            },
            padding:            0,
            enterable:          true,
            animationThreshold: 0,
        },
        legend:  {
            orient:       'horizontal',
            bottom:       0,
            data:      props.legends,
            selectedMode: false // lgs.theJourney.hasOneTrack() ? false : 'multiple',
        },
        grid:    {
            top:          0.5 * gutter,
            left:         2 * gutter,
            right:        gutter,
            bottom:       2 * gutter,
            containLabel: true,
        },
        xAxis:   [
            {
                type:          'value',
                name:          props.data.axisNames.x ?? '',
                nameTextStyle: {
                    align:         'right',
                    verticalAlign: 'top',
                    fontWeight:    'bold',
                    padding:       [1.5 * gutter, 0, 0, 0],
                },
                axisLabel:     {
                    alignMaxLabel: 'right', // hide the last....
                    showMaxLabel:false
                },
                axisLine:      {onZero: false},
                nameGap:       0,
                minInterval:5,
                max:           'dataMax',// value=>value.max
            },
        ],
        yAxis:   [
            {
                type:          'value',
                name:          props.data.axisNames.y ?? '',
                nameRotate:    90,
                nameLocation:  'end',
                nameTextStyle: {
                    align:         'right',
                    verticalAlign: 'bottom',
                    fontWeight:    'bold',
                    padding:       [0, 0, 3.5 * gutter, 0],
                },
                minInterval:5,
                min: (value) => Math.floor(value.min / 10) * 10,
                splitNumber:   7, //TODO
                nameGap:       0,
            },
        ],
        dataset: props.data.dataset,
        series:  series,
        dataZoom: [{type: 'inside'}]

    }


    useEffect(() => {
        const chart = instance.current.getEchartsInstance()
        __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, chart)
        chart.on('dataZoom', function () {
            // Zoom state activated
            mainStore.components.profile.zoom=true
        });
    })

    const resize = () => {
        if (mainSnap.components.profile.show) {
            const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
            const container = document.getElementById(`profile-${CHART_ELEVATION_VS_DISTANCE}`)
            const dimensions = container.getBoundingClientRect()
            if (dimensions.width > 0) {
                mainStore.components.profile.width = dimensions.width
                mainStore.components.profile.height = dimensions.height
            }
        }
    }

    window.addEventListener('resize', resize)

    const dispatchEvents = {
        'rendered': (time,chart)=> {
            resize()
        },
    }

    return (<>
            {props.data &&

                <ReactECharts option={option}
                              style={{width: mainSnap.components.profile.width, height: mainSnap.components.profile.height}}
                              opts={{renderer: 'svg'}}
                              ref={instance}
                              onEvents = {dispatchEvents}
                />
            }
        </>
    )

}
