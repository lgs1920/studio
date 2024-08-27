import { faArrowDownToLine, faArrowLeftToLine, faArrowRightToLine, faCircle } from '@fortawesome/pro-regular-svg-icons'
import { sprintf }                                                            from 'sprintf-js'
import { subscribe }                       from 'valtio'
import {
    Utils,
}                                          from '../../components/TracksEditor/Utils.js'
import { FA2SL }                           from '../../Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS } from '../../Utils/UnitUtils'
import { ProfileTrackMarker }              from '../ProfileTrackMarker'
import { Track }                                                              from '../Track'

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
            series: [], options: options
        }

        let distance = 0
        const colors=[]
        lgs.theJourney.tracks.forEach((track) => {
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
                colors.push(track.marker.foregroundColor)
            }
        })
        data.options.markers={
            colors:colors,
            size:6
        }

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
    tooltipElevationVsDistance =  (options) => {

        if (__.ui.wanderer.running) {
            return ''
        }
        // Display in
        //TODO Use renderToString from react: touse  ???
        //TODO here : https://react.dev/reference/react-dom/server/renderToString
        const data = options.w.config.series[options.seriesIndex].data
        const coords = data[options.dataPointIndex]
        const length = data[data.length - 1].x

        // Show on map
        if (lgs.configuration.profile.marker.track.show) {
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

    showOnMap = async (options) => {
        const data = options.w.config.series[options.seriesIndex].data
        const coords = data[options.dataPointIndex]
        lgs.theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[options.seriesIndex])}) // TODO Ameliorer

        if (!lgs.theTrack.marker.drawn) {
            await lgs.theTrack.marker.draw()
        }

        await lgs.theTrack.marker.move([coords.point.longitude, coords.point.latitude, coords.point.elevation])
    }

    /**
     * Display a marker on the profil Chart
     *
     * @param serie {number}
     * @param index {number}
     */
    updateChartMarker = (serie, index) => {
        const MARKER = 'wander-marker'
        PROFILE_CHARTS.forEach(id => {
            const chart = this.charts.get(id)
            const data = chart.ctx.opts.series[serie].data[index]
            chart.removeAnnotation(MARKER)
            chart.addPointAnnotation({
                                         id:     MARKER,
                                         x:      data.x,
                                         y:      data.y,
                                         marker: this.chartMarker()
                                     })
        })
    }

    /**
     * Define a marker for the chart
     *
     * @param color
     * @return {{fillColor: (string|*|string), strokeWidth, size, strokeColor: (string|*|string)}}
     */
    chartMarker =(color = null)=>{
        return  {
            size: lgs.configuration.profile.marker.chart.size,
                fillColor: color??lgs.theTrack.marker.foregroundColor,
                strokeColor: lgs.configuration.profile.marker.chart.border.color,
                strokeWidth: lgs.configuration.profile.marker.chart.border.width,
        }
    }

    getMarkerCoordinates=() =>{
        // Sélectionnez l'élément du marqueur par son identifiant unique
        var markerElement = document.querySelector('#chart .apexcharts-point-annotation-marker[rel="unique-marker-id"]');

        if (markerElement) {
            // Obtenez les coordonnées du marqueur par rapport à l'élément DOM contenant le graphique
            var rect = markerElement.getBoundingClientRect();
            var chartElement = document.querySelector('#chart');
            var chartRect = chartElement.getBoundingClientRect();

            var x = rect.left - chartRect.left;
            var y = rect.top - chartRect.top;

            console.log('Coordonnées du marqueur en pixels:', { x: x, y: y });
            return { x: x, y: y };
        } else {
            console.log('Marqueur non trouvé');
            return null;
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
           // this.charts.get(id).updateOptions({marker:this.chartMarker('#ff0000')})
        })
       lgs.theTrack.marker.update()
    }

    /**
     * Update Titles of Profile
     */
    updateTitle = () => {
        const series = []
        lgs.theJourney.tracks.forEach((track) => {
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
        if (lgs.configuration.profile.marker.track.show) {
           lgs.theTrack?.marker.draw()
        }
    }

    /**
     *
     * @param force
     * @param color
     * @param borderColor
     */
    initMarker = (
        {
            force=false,
            color=null,
            borderColor= null,
        }
    ) => {
        if (lgs.theTrack && (lgs.theTrack.marker === undefined || force)) {
           lgs.theTrack.marker = new ProfileTrackMarker(
               {
                   track:lgs.theTrack,
                   color:color??lgs.theTrack.color,
                   border:{color:borderColor??'transparent'}}
           )
            __.ui.wanderer.marker  =lgs.theTrack.marker
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