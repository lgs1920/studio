import { faArrowDownToLine, faArrowLeftToLine, faArrowRightToLine, faCircle } from '@fortawesome/pro-regular-svg-icons'
import { sprintf }                                                            from 'sprintf-js'
import { subscribe }                       from 'valtio'
import {
    Utils,
}                                          from '../../components/TracksEditor/Utils.js'
import { FA2SL }                           from '../../Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS } from '../../Utils/UnitUtils'
import { ProfileTrackMarker }              from '../ProfileTrackMarker'

export class Profiler {

    charts = null

    constructor(lgs) {
        // Singleton
        if (Profiler.instance) {
            return Profiler.instance
        }
        this.charts = new Map()

        // We need to interact with  Editor
        subscribe(lgs.journeyEditorStore, this.adaptWidth)


        Profiler.instance = this

    }

    /**
     * Adapt the profiler width, according to editor pane usage
     *
     */
    adaptWidth = () => {
        const offset = lgs.journeyEditorStore.show ? Utils.panelOffset() : 0
        __.ui.css.setCSSVariable('--lgs-profile-pane-width', `calc( 100% - ${offset})`)
    }

    /**
     *
     * @param type {number} Plot type
     */
    prepareData = (type = ELEVATION_VS_DISTANCE) => {
        if (lgs.theJourney === null) {
            return
        }

        // For each typeof chart and according to units System, we set the units to each axis
        let units, titles
        switch (type) {
            case ELEVATION_VS_DISTANCE :
                units = {x: DISTANCE_UNITS, y: ELEVATION_UNITS}
                titles = {x: 'Distance', y: 'Elevation'}
        }

        const options = {
            xaxis: {
                title: {
                    text: `${titles.x} - ${units.x[lgs.configuration.unitsSystem]}`,
                },
            },
            yaxis: {
                title: {
                    text: `${titles.y} - ${units.y[lgs.configuration.unitsSystem]}`,
                },
                decimalsInFloat: 1,
                tickAmount: 4,
            },
            tooltip: {
                custom: this.tooltipElevationVsDistance,
            },
        }

        const data = {
            series: [], options: options,
        }

        let distance = 0
        lgs.theJourney.tracks.forEach((track, slug) => {
            if (track.visible && track.metrics.points !== undefined) {
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
                            coords.x = __.convert(distance).to(units.x[lgs.configuration.unitsSystem])
                            coords.y = __.convert(point.altitude).to(units.y[lgs.configuration.unitsSystem])
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
    tooltipElevationVsDistance = (options) => {

        // Display in
        //TODO Use renderToString from react: touse  ???
        //TODO here : https://react.dev/reference/react-dom/server/renderToString
        const data = options.w.config.series[options.seriesIndex].data
        const coords = data[options.dataPointIndex]
        const length = data[data.length - 1].x

        // Show on map
        if (lgs.configuration.profile.marker.show) {
            this.showOnMap(options)
        }

        // Show on Profile
        return `
<div id="elevation-distance-tooltip">
         <span>[ ${coords.point.latitude} , ${coords.point.longitude} ]</span>
         <span class="point-distance">
           <sl-icon library="fa" name="${FA2SL.set(faArrowLeftToLine)}"></sl-icon>
            ${sprintf('%\' .1f', coords.x)}  ${DISTANCE_UNITS[lgs.configuration.unitsSystem]}
            <sl-icon library="fa" name="${FA2SL.set(faCircle)}"></sl-icon>
            ${sprintf('%\' .1f', length - coords.x)}  ${DISTANCE_UNITS[lgs.configuration.unitsSystem]}
            <sl-icon library="fa" name="${FA2SL.set(faArrowRightToLine)}"></sl-icon>
        </span>                       
        <span>${sprintf('%\' .1f', coords.y)} ${ELEVATION_UNITS[lgs.configuration.unitsSystem]}</span>
        <sl-icon library="fa" name="${FA2SL.set(faArrowDownToLine)}"></sl-icon>
    </div>
    `
    }

    showOnMap = (options) => {
        const data = options.w.config.series[options.seriesIndex].data
        const coords = data[options.dataPointIndex]

        if (!lgs.theTrack.profileTrackMarker.drawn) {
           lgs.theTrack.profileTrackMarker.draw()
        } else {
           lgs.theTrack.profileTrackMarker.moveTo([coords.point.longitude, coords.point.latitude])
        }

    }

    /**
     * Update Color of tracks
     */
    updateColor = () => {
        const series = []
        lgs.theJourney.tracks.forEach((track) => {
            series.push({color: track.color})
        })
        PROFILE_CHARTS.forEach(id => {
            this.charts.get(id).updateSeries(series)
        })
       lgs.theTrack.profileTrackMarker.update()
    }

    /**
     * Update Titles of Profile
     */
    updateTitle = () => {
        const series = []
        lgs.theJourney.tracks.forEach((track, slug) => {
            series.push({name: track.title})
        })
        PROFILE_CHARTS.forEach(id => {
            this.charts.get(id).updateSeries(series)
        })

    }

    /**
     * Update track visibility
     *
     * We draw all
     */
    updateTrackVisibility = () => {
        this.prepareData()
    }

    /**
     * Force Profile to be redrawn
     */
    draw = () => {
        lgs.mainProxy.components.profile.key++
        if (lgs.configuration.profile.marker.show) {
           lgs.theTrack.profileTrackMarker.draw()
        }
    }

    initMarker = () => {
        if (lgs.theTrack && lgs.theTrack.profileTrackMarker === undefined) {
           lgs.theTrack.profileTrackMarker = new ProfileTrackMarker(
               {color:lgs.theTrack.color,border:{color:'transparent'}}
           )
        }
    }

    drawMarker = () => {
        if (lgs.configuration.profile.marker.show) {
            this.initMarker()
           lgs.theTrack.profileTrackMarker.draw()
        }
    }
    resetChart = () => {
        PROFILE_CHARTS.forEach(id => {
            ApexCharts.exec(id, 'resetSeries', true, true)
        })
    }

    /**
     * Set the profil visibility, according to some criterias
     *
     * @return {boolean}
     */
    setVisibility = (journey = lgs.theJourney) => {
        lgs.mainProxy.canViewProfile =
            lgs.configuration.profile.show &&              // By configuration
            journey !== undefined &&                        // During init
            journey !== null &&                             // same
            journey.visible &&                              // Journey visible
            lgs.mainProxy.canViewJourneyData &&            // can view data
            Array.from(journey.tracks.values())             // Has Altitude for each track
                .every(track => track.hasAltitude)

    }
}

export const ELEVATION_VS_DISTANCE = 0
export const CHART_ELEVATION_VS_DISTANCE = 'elevation-distance'
export const PROFILE_CHARTS = [CHART_ELEVATION_VS_DISTANCE]