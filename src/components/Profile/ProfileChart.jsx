import './style.css'
import { useEffect }                   from 'react'
import { default as Chart }            from 'react-apexcharts'
import { useSnapshot }                 from 'valtio'
import { CHART_ELEVATION_VS_DISTANCE } from '../../core/ui/Profiler'


export const ProfileChart = function ProfileChart(props) {

    const options = {
        chart: {
            id: CHART_ELEVATION_VS_DISTANCE,
            toolbar: {
                show: false,
            }, offsetX: 0, offsetY: 0, parentHeightOffset: 0, zoom: {
                type: 'x', enabled: true, autoScaleYaxis: true,
            }, events: {
                beforeMount: function (chartContext, config) {
                    __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, ApexCharts.getChartByID(CHART_ELEVATION_VS_DISTANCE))
                },
            },

        }, fill: {
            type: 'gradient', gradient: {
                shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.9, stops: [0, 100],
            },
        }, xaxis: {
            type: 'numeric', title: {
                text: props.options.xaxis.title.text ?? '',
            }, tooltip: {
                enabled: false,
            },
            forceNiceScale: true,
        }, yaxis: {
            type: 'numeric',
            title: {
                text: props.options.yaxis.title.text ?? '',
            },
            // tickAmount: props.options.yaxis.tickAmount,
            decimalsInFloat: props.options.yaxis.title.decimalsInFloat ?? 0,
            forceNiceScale: true,
        }, dataLabels: {
            enabled: false,
        }, tooltip: {
            custom: props.options.tooltip.custom,
            followCursor: true,
        }, grid: {
            show: true, xaxis: {
                lines: {
                    show: true,
                },
            }, yaxis: {
                lines: {
                    show: true,
                },
            },
        }, legend: {
            markers: {
                radius: 3,
                //onClick: __.ui.profilerupdateTrackVisibility,
            },
            itemMargin: {
                horizontal: 5, vertical: 0,
            },
            onItemClick: {
                toggleDataSeries: false,
            },

        },
        // title: {
        //     text: lgs?.theJourney?.title ?? '',
        //     align: 'left',
        //     margin: 0,
        //     style: {
        //         fontSize: '14px', //__.ui.css.getCSSVariable('--lgs-font-size'),
        //         fontWeight: 700,
        //         fontFamily: __.ui.css.getCSSVariable('--lgs-font-family'),
        //     },
        // },
        plotOptions: {
            area: {
                fillTo: 'origin',
            },
        },

    }

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    useEffect(() => {
        // Force chart to re render
        window.dispatchEvent(new Event('resize'))
    })

    return (<>
            {props.series &&
                <Chart options={options}
                       series={props.series}
                       height={props.height}
                       width={'100%'}
                       type={'area'}
                />
            }
        </>
    )

}
