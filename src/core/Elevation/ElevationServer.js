/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ElevationServer.js
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

export class ElevationServer {

    // "fake" servers
    static NONE = 'none'
    static CLEAR = 'clear'
    static FILE_CONTENT = 'file-content'

    // Real servers
    static OPEN_ELEVATION = 'open-elevation'
    static IGN_GEOPORTAIL = 'ign-geoportail'

    /**
     * Define elevation servers metadata
     */
    static FAKE_SERVERS = new Map([
                                      [
                                          ElevationServer.NONE,
                                          {
                                              label: 'No Elevation Data',
                                              id:    ElevationServer.NONE,
                                              icon: 'regular-mountain-slash',
                                          },
                                      ],
                                      [
                                          ElevationServer.CLEAR,
                                          {
                                              label: 'No Elevation Data',
                                              id:    ElevationServer.CLEAR,
                                              icon:          'trash-can',
                                              labelSelection: 'No Elevation Data',
                                              iconSelection: 'regular-mountain-slash',
                                          },
                                      ],
                                      [
                                          ElevationServer.FILE_CONTENT,
                                          {
                                              label: 'File Elevation Data',
                                              id:    ElevationServer.FILE_CONTENT,
                                              icon:  'file-waveform',
                                              origin: true,
                                          },
                                      ],
                                  ])

    static SERVERS = new Map([
                                 [
                                     ElevationServer.OPEN_ELEVATION,
                                     {
                                         label: 'Open-Elevation (Worldwide, 30m)',
                                         id:    ElevationServer.OPEN_ELEVATION,
                                         doc:   'https://github.com/Jorl17/open-elevation/blob/master/docs/api.md',
                                         url:   'https://api.open-elevation.com/api/v1/lookup',
                                         icon:  'map-location',
                                     },
                                 ],
                                 [
                                     ElevationServer.IGN_GEOPORTAIL,
                                     {
                                         label:       'IGN GeoPortail (France, 2.5m)',
                                         id:          'ign-geoportail',
                                         doc:         'https://geoservices.ign.fr/documentation/services/services-deprecies/calcul-altimetrique-rest',
                                         url:         'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json',
                                         maxPerQuery: 5000,
                                         icon:        'map-location',
                                     },
                                 ],
                             ])

    static ERROR_DATA = -99999.0
    static WRONG_DATA_ERROR = new Error('The data is inconsistent. <br/>Elevation Server data probably not available for this part of the globe!')

    constructor(id) {
        this.instance = ElevationServer.getServer(id)
        this.instance.maxPerQuery = this.instance?.maxPerQuery ?? 10000000
        this.fetchElevation = null
    }

    static getServer = (id) => {
        return ElevationServer.SERVERS.get(id) ?? ElevationServer.FAKE_SERVERS.get(id)
    }

    /**
     * IGN GeoPortail Implementation
     */
    static fetchIGNGeoportail = async (coordinates) => {
        const lat = [], lon = []
        coordinates.forEach(c => {
            lon.push(c[0])
            lat.push(c[1])
        })

        const payload = {
            lon:      lon.join('|'),
            lat:      lat.join('|'),
            zonly:    'true',
            resource: 'ign_rge_alti_wld',
        }

        try {
            const response = await lgs.axios.post(ElevationServer.SERVERS.get(ElevationServer.IGN_GEOPORTAIL).url, payload)
            const data = response.data.elevations.map((point, index) => {
                if (point === ElevationServer.ERROR_DATA) {
                    throw ElevationServer.WRONG_DATA_ERROR
                }
                return [lon[index], lat[index], point]
            })
            return {coordinates: data, hasElevation: true}
        }
        catch (error) {
            return {errors: [error]}
        }
    }

    /**
     * Open Elevation Implementation
     */
    static fetchOpenElevation = async (coordinates) => {
        const payload = {
            locations: coordinates.map(c => ({longitude: c[0], latitude: c[1]})),
        }

        try {
            const response = await lgs.axios({
                                                 method:  'post',
                                                 url:     ElevationServer.SERVERS.get(ElevationServer.OPEN_ELEVATION).url,
                                                 data:    payload,
                                                 headers: {
                                                     'content-type': 'application/json',
                                                     'Accept':       'application/json',
                                                 },
                                             })
            const data = response.data.results.map(p => [p.longitude, p.latitude, p.elevation])
            return {coordinates: data, hasElevation: true}
        }
        catch (error) {
            return {errors: [error]}
        }
    }

    /**
     * Clear elevation data (Remove Z index)
     */
    static clearElevation = async (coordinates) => {
        const data = coordinates.map(c => [c[0], c[1]])
        return {
            coordinates:  data,
            hasElevation: false, // Explicitly tell the UI we have no elevation
        }
    }

    /**
     * Reset to original file data
     */
    static resetToFileElevation = async (coordinates, origin) => {
        const data = coordinates.map((c, index) => {
            const elevation = origin[index]?.[2]
            return elevation !== undefined ? [c[0], c[1], elevation] : [c[0], c[1]]
        })

        // We consider it has elevation if the first point has a Z value
        const hasElevation = data[0]?.length > 2
        return {coordinates: data, hasElevation}
    }

    /**
     * Main entry point to get elevation
     * @param {Array} coordinates - [[lon, lat], ...]
     * @param {Array} origin - Original coordinates for reset
     * @returns {Promise} Resolves with {coordinates, hasElevation, errors}
     */
    getElevation = (coordinates, origin = []) => {
        return new Promise((resolve, reject) => {
            if (this.instance.id === ElevationServer.NONE) {
                return resolve({
                                   coordinates:  coordinates,
                                   hasElevation: true,
                                   errors:       null,
                               })
            }

            switch (this.instance.id) {
                case ElevationServer.CLEAR:
                    this.fetchElevation = ElevationServer.clearElevation
                    break
                case ElevationServer.FILE_CONTENT:
                    this.fetchElevation = ElevationServer.resetToFileElevation
                    break
                case ElevationServer.OPEN_ELEVATION:
                    this.fetchElevation = ElevationServer.fetchOpenElevation
                    break
                case ElevationServer.IGN_GEOPORTAIL:
                    this.fetchElevation = ElevationServer.fetchIGNGeoportail
                    break
            }

            let chunks = [[], []]
            for (let cursor = 0; cursor < coordinates.length; cursor += this.instance.maxPerQuery) {
                chunks[0].push(coordinates.slice(cursor, cursor + this.instance.maxPerQuery))
                chunks[1].push(origin.slice(cursor, cursor + this.instance.maxPerQuery))
            }

            let promises = chunks[0].map((coords, index) => this.fetchElevation(coords, chunks[1][index]))

            Promise.allSettled(promises).then((results) => {
                const data = {
                    coordinates:  [],
                    errors:       [],
                    hasElevation: true,
                }

                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        if (result.value.coordinates) {
                            data.coordinates.push(...result.value.coordinates)
                        }
                        // If one chunk says no elevation, the whole set is flagged
                        if (result.value.hasElevation === false) {
                            data.hasElevation = false
                        }
                        if (result.value.errors) {
                            data.errors.push(...result.value.errors)
                        }
                    }
                    else {
                        data.errors.push(result.reason?.errors ?? result.reason)
                    }
                })

                if (data.errors.length > 0) {
                    reject({errors: data.errors})
                }
                else {
                    resolve({
                                coordinates:  data.coordinates,
                                hasElevation: data.hasElevation,
                                errors:       null,
                            })
                }
            }).catch((error) => {
                reject({errors: error})
            })
        })
    }
}