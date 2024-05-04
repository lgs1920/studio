import './style.css'
import { useEffect }        from 'react'
import { default as Chart } from 'react-apexcharts'
import { useSnapshot }      from 'valtio'

export const ProfileChart = function ProfileChart(props) {

    //read version
    const options = {
        chart: {
            id: 'profile-chart',
            toolbar: {
                show: false,
            },
            offsetX: 0,
            offsetY: 0,
            parentHeightOffset: 0,
            zoom: {
                type: 'x',
                enabled: true,
                autoScaleYaxis: true,
            },
            //events: {},

        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.5,
                opacityTo: 0.9,
                stops: [0, 100],
            },
        },
        xaxis: {
            type: 'numeric',
            title: {
                text: props.options.xaxis.title.text ?? '',
            },
            tooltip: {
                enabled: false,
            },
        },
        yaxis: {
            type: 'numeric',
            title: {
                text: props.options.yaxis.title.text ?? '',
            },
            tickAmount: props.options.yaxis.tickAmount,
            decimalsInFloat: props.options.yaxis.title.decimalsInFloat ?? 0,

        }, dataLabels: {
            enabled: false,
        },
        tooltip: {
            custom: props.options.tooltip.custom,
        },
        grid: {
            show: true,
            xaxis: {
                lines: {
                    show: true,
                },
            },
            yaxis: {
                lines: {
                    show: true,
                },
            },
        },
    }
    const mainStore = vt3d.mainProxy
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
    </>)

}
