import { faMountains }                                   from '@fortawesome/pro-regular-svg-icons'
import { faArrowLeftLongToLine, faArrowRightLongToLine } from '@fortawesome/pro-solid-svg-icons'
import { FA2SL }                                         from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS }               from '@Utils/UnitUtils'
import * as echarts                                      from 'echarts/core'

import { DateTime }           from 'luxon'
import { sprintf }            from 'sprintf-js'
import { ProfileTrackMarker } from '../ProfileTrackMarker'
import { Track }              from '../Track'

export class Profiler {

    charts = null

    constructor(lgs) {
        // Singleton
        if (Profiler.instance) {
            return Profiler.instance
        }
        this.charts = new Map()

        Profiler.instance = this

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
        let units, titles, tooltip
        switch (type) {
            case ELEVATION_VS_DISTANCE :
                units = {x: DISTANCE_UNITS, y: ELEVATION_UNITS}
                titles = {x: DISTANCE, y: ELEVATION}
                tooltip = this.tooltipElevationVsDistance
        }

        const data = {
            legend: {data:[]},
            dataset:    [],
            options:    [],
            axisNames:  {},
            dimensions: [DISTANCE, ELEVATION, TIME, POINT],
        }

        // Let's define missing values
        let distance = 0
        lgs.theJourney.tracks.forEach((track) => {
            if (track.visible && track.metrics.points !== undefined) {
                const trackDataset = {
                    id:     track.slug,
                    source: [],
                }
                track.metrics.points.forEach(point => {
                    distance += point.distance
                    let coords = []
                    switch (type) {
                        case ELEVATION_VS_DISTANCE : {
                            coords = [
                                __.convert(distance).to(units.x[lgs.settings.getUnitSystem.current]),
                                __.convert(point.altitude).to(units.y[lgs.settings.getUnitSystem.current]),
                                null, //TODO Time
                                point,
                            ]
                        }
                    }
                    trackDataset.source.push(coords)
                })
                data.dataset.push(trackDataset)
                data.options.push({
                                      color:   track.color,
                                      name:    track.title,
                                      //  marker:  track.marker.foregroundColor,
                                      dataset: track.slug,
                                  })

            }
        })

        data.axisNames = {
            x: `${titles.x} - ${units.x[lgs.settings.getUnitSystem.current]}`,
            y: `${titles.y} - ${units.y[lgs.settings.getUnitSystem.current]}`,
        }

        return data
    }

    /**
     * This overloads the default tooltip for the chart Elevation vs Distance
     *
     * @return {string}  HTML
     */
    tooltipElevationVsDistance = ([serie, index, distance, elevation, time, point, distances, colors]) => {

        if (__.ui.wanderer.running) {
            return ''
        }

        // Show on map
        if (lgs.settings.getProfile.marker.track.show) {
            this.showOnMap(serie, point.longitude, point.latitude, elevation)
        }

        let date = {day: '', time: ''}
        if (point.time) {
            date = {
                time: DateTime.fromISO(point.time).toLocaleString(DateTime.TIME_SIMPLE),
            }
        }
        const distance1 = distances[distances.length - 1].end
        const start2 = distances[serie].start
        const distance2 = distances[serie].end


        // Build tooltip
        const header = `
            <div id="elevation-distance-tooltip">
                <div class="point-distance">
                    <span>[${point.latitude}, ${point.longitude}]</span>
                    <span>${date.time}</span>
            </div>`

        const altitude = `<sl-icon library="fa" name="${FA2SL.set(faMountains)}"  style="color:${colors[serie]}"></sl-icon>&nbsp;
${sprintf('%\' .1f', elevation ?? 0)} ${ELEVATION_UNITS[lgs.settings.getUnitSystem.current]}`
        const global = distances.length > 1 ? `
            <div class="point-distance line" style="--line-color=${colors[serie]}">
            <span class="tooltip-icon"><sl-icon library="fa" name="${FA2SL.set(faArrowLeftLongToLine)}"></sl-icon></span>
            <span class="tooltip-data">
                ${sprintf('%\' .1f', distance ?? 0)}  ${DISTANCE_UNITS[lgs.settings.getUnitSystem.current]}
            </span>
            <span class="tooltip-data altitude">${altitude}</span>
            <span class="tooltip-data">
            ${sprintf('%\' .1f', distance1 ? distance1 - distance : 0)}  ${DISTANCE_UNITS[lgs.settings.getUnitSystem.current]}</span>
            <span  class="tooltip-icon">
            </span>
        </div> 
        ` : `<span class="tooltip-data altitude">${altitude}</span>`
        const relative = `
        <div class="point-distance line" style="--line-color:${colors[serie]}">
           <span class="tooltip-icon">
            <sl-icon library="fa" name="${FA2SL.set(faArrowLeftLongToLine)}"  style="color:${colors[serie]}"></sl-icon>
            </span>
            <span class="tooltip-data">
            ${sprintf('%\' .1f', distance - start2 ?? 0)}  ${DISTANCE_UNITS[lgs.settings.getUnitSystem.current]}
            </span>
            <span  class="tooltip-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="27px" height="17px">
                <path stroke="${colors[serie]}" d="M0 7L25 7" stroke-width="2" stroke-linecap="butt" stroke-miterlimit="10"></path>
                <path stroke="${colors[serie]}"  fill="${__.ui.css.getCSSVariable('--sl-panel-background-color')}" d="M18.1 7A5.6 5.6 0 1 1 18.1 6.9994" stroke-width="2" stroke-linecap="butt" stroke-miterlimit="10"></path>
            </svg>
            </span>

            <span class="tooltip-data">
            ${sprintf('%\' .1f', distance2 ? distance2 - distance : 0)}  ${DISTANCE_UNITS[lgs.settings.getUnitSystem.current]}
            </span>
            <span class="tooltip-icon">
            <sl-icon library="fa" name="${FA2SL.set(faArrowRightLongToLine)}"  style="color:${colors[serie]}"></sl-icon>
            </span>
        </div>`
        return header + global + relative
    }

    showOnMap = async (serie, longitude, latitude, elevation) => {
        const theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[serie])})
        if (!theTrack.marker.drawn) {
            await theTrack.marker.draw()
        }
        await theTrack.marker.move([longitude, latitude, elevation])
    }

    /**
     * Display a marker on the profil Chart
     *
     * @param serie {number}
     * @param index {number}
     */
    updateChartMarker = (serie, index) => {
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        chart.dispatchAction({
                                 type:        'showTip',
                                 seriesIndex: serie,
                                 dataIndex:   index, // Index du point marqué
                             })
    }




    /**
     * Update Color of tracks
     */
    updateColor = () => {
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        const options = {series: []}

        Array.from(lgs.theJourney.tracks).forEach(([slug,track]) => {
            const color = __.ui.ui.hexToRGBA(track.color, 'rgb')
            options.series.push({
                             itemStyle: {
                                 color: color,
                             },

                             lineStyle: {
                                 color: color,
                             },

                             areaStyle: {
                                 color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                     {offset: 0.5, color: __.ui.ui.RGB2RGBA(color, 0.5)},
                                     {offset: 1, color: __.ui.ui.RGB2RGBA(color, 0.0)},
                                 ]),
                             },
                         })
        })

        chart.setOption(options)
        this.draw().then(() => {
            __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, chart)
            lgs.theTrack.marker.update()
        })

    }

    /**
     * Update Titles  and legends of Profile
     */
    updateTitle = () => {
        const options = {legend:{data:[]},series: []}
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        Array.from(lgs.theJourney.tracks).forEach(([slug,track]) => {
            options.series.push({name: track.title})
            options.legend.data.push({name:track.title})
        })

        chart.setOption(options)
        this.draw().then(() => {
            __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, chart)
        })
    }

    /**
     * Update track visibility
     *
     * We draw all
     */
    updateTrackVisibility = (event = null) => {
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        if (event) {
            // We come from chart legend selection
            const [slug,track] = Array.from(lgs.theJourney.tracks).find(([slug,track]) => track.title === event.name);
            lgs.theJourney.tracks.get(slug).visible = false
//TODO mettre la legend
        } else {

            const selected = {}
            Array.from(lgs.theJourney.tracks).forEach(([slug, track]) => {
                selected[track.title] = track.visible
            })
            chart.setOption({selected: selected})
            this.prepareData()
        }
        this.draw().then(() => {
            __.ui.profiler.charts.set(CHART_ELEVATION_VS_DISTANCE, chart)
        })
    }


    /**
     * Force Profile to be redrawn
     */
    draw = async () => {

        lgs.mainProxy.components.profile.key++
        if (lgs.settings.getProfile.marker.track.show) {
            //  await lgs.theTrack?.marker.draw()
        }
        this.resetZoom()
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
                   visible: false,
                   color:color??lgs.theTrack.color,
                   border:  {color: borderColor ?? 'transparent'},
               },
           )
            __.ui.wanderer.marker  =lgs.theTrack.marker
        }
    }

    resetZoom = () => {
        const proxy=lgs.mainProxy
        proxy.components.profile.zoom=false
    }

    /**
     * Set the profil visibility, according to some criterias
     *
     * @return {boolean}
     */
    setVisibility = (journey = lgs.theJourney) => {
        lgs.mainProxy.canViewProfile =
            lgs.settings.getProfile.show &&              // By configuration
            journey !== undefined &&                        // During init
            journey !== null &&                             // same
            journey.visible &&                              // Journey visible
            lgs.mainProxy.canViewJourneyData &&            // can view data
            Array.from(journey.tracks.values())             // Has Altitude for each track
                .every(track => track.hasAltitude)
    }
}

export const ELEVATION_VS_DISTANCE = 0
export const ELEVATION = 'Elevation'
export const DISTANCE = 'Distance'
export const TIME = 'Time'
export const POINT = 'point'
export const CHART_ELEVATION_VS_DISTANCE = `${ELEVATION}-${DISTANCE}`
export const PROFILE_CHARTS = [CHART_ELEVATION_VS_DISTANCE]