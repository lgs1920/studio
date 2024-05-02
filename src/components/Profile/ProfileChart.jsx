import './style.css'
import { default as Chart } from 'react-apexcharts'
import { useSnapshot }      from 'valtio'
import { Utils }            from './Utils'


//read version
const state = {
    options: {
        chart: {
            id: 'profile-chart', toolbar: {
                show: false,
            }, offsetX: 10, offsetY: 10, parentHeightOffset: 0, background: '#F6F8FA',

        }, xaxis: {
            type: 'numeric',
        }, dataLabels: {
            enabled: false,
        },
    },
}

export const ProfileChart = function ProfileChart() {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)
    const height = '220px'  // __.ui.css.getCSSVariable('--vt3d-profile-pane-height')

    let data = Utils.prepareData()
    console.log(data)
    return (<>
        {<Chart options={state.options} series={data} height={height}/>}
    </>)

}
