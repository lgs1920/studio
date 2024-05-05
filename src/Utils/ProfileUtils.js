import {
    faArrowDownToLine, faArrowLeftToLine, faArrowRightToLine, faCircleDot,
}                                from '@fortawesome/pro-regular-svg-icons'
import { foot, km, meter, mile } from '@Utils/UnitUtils'
import { sprintf }               from 'sprintf-js'
import { FA2SL }                 from './FA2SL'

export class ProfileUtils {

    /**
     *
     * @param type {number} Plot type
     */
    static prepareData = (type = ELEVATION_VS_DISTANCE) => {
        if (vt3d.theJourney === null) {
            return
        }

        // For each typeof chart and according to units System, we set the units to each axis
        let units, titles
        switch (type) {
            case ELEVATION_VS_DISTANCE :
                units = {x: [km, mile], y: [meter, foot]}
                titles = {x: 'Distance', y: 'Elevation'}
        }

        const options = {
            xaxis: {
                title: {
                    text: `${titles.x} - ${units.x[vt3d.configuration.unitsSystem]}`,
                },
            },
            yaxis: {
                title: {
                    text: `${titles.y} - ${units.y[vt3d.configuration.unitsSystem]}`,
                },
                decimalsInFloat: 1,
                tickAmount: 4,
            },
            tooltip: {
                custom: ProfileUtils.tooltipElevationVsDistance,
            },
        }

        const data = {
            series: [], options: options,
        }

        let distance = 0
        vt3d.theJourney.tracks.forEach((track, slug) => {
            if (track.visible) {
                const dataSet = {
                    data: [],
                    color: track.color,
                    name: track.title,
                }
                track.metrics.points.forEach(point => {
                    distance += point.distance
                    let coords = {}
                    switch (type) {
                        case ELEVATION_VS_DISTANCE : {
                            coords.x = __.convert(distance).to(units.x[vt3d.configuration.unitsSystem])
                            coords.y = __.convert(point.altitude).to(units.y[vt3d.configuration.unitsSystem])
                            coords.point = point
                        }
                    }
                    dataSet.data.push(coords)
                })
                data.series.push(dataSet)
            }
        })

        return data
    }

    /**
     * This overloads the default tooltip for the chart Elevation vs Distance
     * THis is a function defined for ApexChart.
     * See https://apexcharts.com/docs/options/tooltip/# (custom option)
     *
     * @param options
     * @return {string}  HTML
     */
    static tooltipElevationVsDistance = (options) => {

        //TODO Use renderToString from react: touse  ???
        //TODO here : https://react.dev/reference/react-dom/server/renderToString
        const data = options.w.config.series[options.seriesIndex].data

        const coords = data[options.dataPointIndex]
        const length = data[data.length - 1].x

        const yUnits = [meter, foot]
        const xUnits = [km, mile]
        return `
<div id="elevation-distance-tooltip">
         <span>[ ${coords.point.latitude} , ${coords.point.longitude} ]</span>
         <span class="point-distance">
           <sl-icon library="fa" name="${FA2SL.set(faArrowLeftToLine)}"></sl-icon>
            ${sprintf('%\' .1f', coords.x)}  ${xUnits[vt3d.configuration.unitsSystem]}
            <sl-icon library="fa" name="${FA2SL.set(faCircleDot)}"></sl-icon>
            ${sprintf('%\' .1f', length - coords.x)}  ${xUnits[vt3d.configuration.unitsSystem]}
            <sl-icon library="fa" name="${FA2SL.set(faArrowRightToLine)}"></sl-icon>
        </span>                       
        <span>${sprintf('%\' .1f', coords.y)} ${yUnits[vt3d.configuration.unitsSystem]}</span>
        <sl-icon library="fa" name="${FA2SL.set(faArrowDownToLine)}"></sl-icon>
    </div>
    `
    }

    /**
     * Update Color of tracks
     */
    static updateColor = () => {
        const series = []
        vt3d.theJourney.tracks.forEach((track, slug) => {
            series.push({color: track.color})
        })
        PROFILE_CHARTS.forEach(id => {
            const chart = ApexCharts.getChartByID(id)
            chart.updateSeries(series)
        })

    }

    /**
     * Update Titles of Profile
     */
    static updateTitle = () => {
        const series = []
        vt3d.theJourney.tracks.forEach((track, slug) => {
            series.push({name: track.title})
        })
        PROFILE_CHARTS.forEach(id => {
            const chart = ApexCharts.getChartByID(id)
            chart.updateSeries(series)
        })

    }

    /**
     * Update track visibility
     *
     * We draw all
     */
    static updateTrackVisibility = () => {
        ProfileUtils.prepareData()
        ProfileUtils.draw()
    }

    /**
     * Force Profile to be redrawn
     */
    static draw = () => {
        vt3d.mainProxy.components.profile.key++
    }
}

export const ELEVATION_VS_DISTANCE = 0
export const CHART_ELEVATION_VS_DISTANCE = 'elevation-distance'
export const PROFILE_CHARTS = [CHART_ELEVATION_VS_DISTANCE]