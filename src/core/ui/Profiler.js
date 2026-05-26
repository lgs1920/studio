/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Profiler.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    buildFlythroughProfileMetricSummary,
    appendFlythroughProfileMetadata,
    extendFlythroughProfileDimensions,
    flythroughSampleFromProfileRow,
}                                                         from '@Core/ui/flythrough/FlythroughProfileProgress'
import { normalizeTrackRenderStyle }                     from '@Utils/cesium/trackRenderStyle'
import { DISTANCE_UNITS, ELEVATION_UNITS }               from '@Utils/UnitUtils'
import * as echarts                                      from 'echarts/core'

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
            legend: {data: []},
            dataset:    [],
            options:    [],
            axisNames:  {},
            dimensions: extendFlythroughProfileDimensions([DISTANCE, ELEVATION, TIME, POINT, UNIT_SYSTEM]),
        }

        // Let's define missing values
        let distance = 0
        lgs.theJourney.tracks.forEach((track, trackIndex) => {
            if (track.visible && track.metrics.points !== undefined) {
                const trackDataset = {
                    id:     track.slug,
                    source: [],
                }
                track.metrics.points.forEach((point, pointIndex) => {
                    distance += point.distance ?? 0
                    const elevation = Number(point.altitude)
                    if (!Number.isFinite(elevation)) {
                        return
                    }
                    let coords = []
                    switch (type) {
                        case ELEVATION_VS_DISTANCE : {
                            coords = appendFlythroughProfileMetadata([
                                __.convert(distance).to(units.x[lgs.settings.unitSystem.current]),
                                __.convert(elevation).to(units.y[lgs.settings.unitSystem.current]),
                                point.time ?? null,
                                point,
                                lgs.settings.unitSystem.current,  // unit system
                            ], {
                                distanceFromStart: distance,
                                trackSlug:         track.slug,
                                trackIndex,
                                pointIndex,
                            })
                        }
                    }
                    trackDataset.source.push(coords)
                })
                if (trackDataset.source.length > 0) {
                    data.dataset.push(trackDataset)
                    data.options.push({
                                          color:       track.color,
                                          name:        track.title,
                                          //  marker:  track.marker.foregroundColor,
                                          dataset:     track.slug,
                                          renderStyle: normalizeTrackRenderStyle(track.renderStyle, {
                                              color:     track.color,
                                              thickness: track.thickness,
                                          }),
                                      })
                }

            }
        })

        data.axisNames = {
            x: `(${units.x[lgs.settings.unitSystem.current]})`,
            y: `(${units.y[lgs.settings.unitSystem.current]})`,
        }

        data.unitSystem = lgs.settings.unitSystem.current

        return data
    }

    /**
     * This overloads the default tooltip for the chart Elevation vs Distance
     *
     * @return {string}  HTML
     */
    tooltipElevationVsDistance = ([serie, index, distance, elevation, time, point, distances, colors]) => {

        if (__.ui.flythrough?.running || __.ui.flythroughRunner.running) {
            return ''
        }

        const sample = flythroughSampleFromProfileRow(
            [distance, elevation, time, point],
            [DISTANCE, ELEVATION, TIME, POINT],
        )
        const summary = buildFlythroughProfileMetricSummary(sample, {
            totalDistance:      distances?.[distances.length - 1]?.end ?? 0,
            direction:          1,
            unitSystem:         lgs.settings.unitSystem.current,
            distancePrecision:  1,
            elevationPrecision: 0,
        })

        if (!summary) {
            return ''
        }

        if (lgs.settings?.getProfile.marker.track.show || false) {
            this.showOnMap(serie, point.longitude, point.latitude, point.altitude ?? point.height ?? elevation)
        }

        return `
            <div id="elevation-distance-tooltip" class="profile-metric-tooltip">
                <span class="tooltip-data">${summary.covered}</span>
                <span class="tooltip-data altitude">${summary.altitudeLabel}</span>
                <span class="tooltip-data">${summary.remaining}</span>
            </div>
        `
    }

    showOnMap = async (serie, longitude, latitude, elevation) => {
        const theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[serie])})
        if (!theTrack.marker.drawn) {
            await theTrack.marker.draw()
        }
        await theTrack.marker.move([longitude, latitude, elevation])
    }

    showSampleOnMap = async (sample) => {
        if (!sample?.trackSlug || !lgs.theJourney?.tracks?.has?.(sample.trackSlug)) {
            return
        }
        const longitude = Number(sample.longitude)
        const latitude = Number(sample.latitude)
        const altitude = Number(sample.altitude ?? sample.height ?? 0)
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
            return
        }

        const track = lgs.theJourney.tracks.get(sample.trackSlug)
        const theTrack = Track.deserialize({object: Track.unproxify(track)})
        if (!theTrack.marker) {
            theTrack.marker = new ProfileTrackMarker({
                parent:  theTrack,
                visible: false,
                color:   theTrack.color,
                border:  {color: 'transparent'},
            })
        }
        if (!theTrack.marker.drawn) {
            await theTrack.marker.draw()
        }
        await theTrack.marker.move([longitude, latitude, Number.isFinite(altitude) ? altitude : 0])
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

        Array.from(lgs.theJourney.tracks).forEach(([slug, track]) => {
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
        const options = {legend: {data: []}, series: []}
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        Array.from(lgs.theJourney.tracks).forEach(([slug, track]) => {
            options.series.push({name: track.title})
            options.legend.data.push({name: track.title})
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
            const [slug, track] = Array.from(lgs.theJourney.tracks).find(([slug, track]) => track.title === event.name)
            lgs.theJourney.tracks.get(slug).visible = false
            //TODO mettre la legend
        }
        else {

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

        lgs.stores.main.components.profile.key++
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
            force = false,
            color = null,
            borderColor = null,
        },
    ) => {
        if (lgs.theTrack && (lgs.theTrack.marker === undefined || force)) {
            lgs.theTrack.marker = new ProfileTrackMarker(
                {
                    track:   lgs.theTrack,
                    visible: false,
                    color:   color ?? lgs.theTrack.color,
                    border:  {color: borderColor ?? 'transparent'},
                },
            )
            __.ui.flythroughRunner.marker = lgs.theTrack.marker
        }
    }

    resetZoom = () => {
        const proxy = lgs.stores.main
        proxy.components.profile.zoom = false
    }

    /**
     * Set the profil visibility, according to some criterias
     *
     * @return {boolean}
     */
    setVisibility = (journey = lgs.theJourney) => {
        lgs.stores.main.canViewProfile =
            lgs.settings.widgets['profile-widget'].configuration.default.show &&  // By configuration
            journey !== undefined &&                                              // During init
            journey !== null &&                                                   // same
            journey.visible &&                                                    // Journey visible
            lgs.stores.main.canViewJourneyData &&                                   // can view data
            Array.from(journey.tracks.values())                                   // Has Altitude for each track
                .every(track => track.hasAltitude)
    }
}

export const ELEVATION_VS_DISTANCE = 0
export const ELEVATION = 'Elevation'
export const DISTANCE = 'Distance'
export const TIME = 'Time'
export const POINT = 'point'
export const UNIT_SYSTEM = 'UnitSystem'
export const CHART_ELEVATION_VS_DISTANCE = `${ELEVATION}-${DISTANCE}`
