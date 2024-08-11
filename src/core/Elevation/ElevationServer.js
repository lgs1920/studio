import { faRegularMountainsSlash }                   from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { faFileWaveform, faMapLocation, faTrashCan } from '@fortawesome/pro-regular-svg-icons'
import axios                                         from 'axios'

export class ElevationServer {

    // "fake" servers
    static NONE = 'none'
    static CLEAR = 'clear'
    static FILE_CONTENT = 'file-content'

    // Real servers
    static OPEN_ELEVATION = 'open-elevation'
    static IGN_GEOPORTAIL = 'ign-geoportail'

    /**
     * Define elevation servers
     */
    static FAKE_SERVERS = new Map(
        [
                                      [
                                          ElevationServer.NONE,
                                          {
                                              label: 'No Elevation Data',
                                              id:    ElevationServer.NONE,
                                              icon:  faRegularMountainsSlash,
                                          },
                                      ],

                                      [
                                          ElevationServer.CLEAR,
                                          {
                                              label: 'Remove Elevation Data',
                                              id:    ElevationServer.CLEAR,
                                              icon:  faTrashCan,
                                              labelSelection: 'No Elevation Data',
                                              iconSelection:  faRegularMountainsSlash,
                                          },
                                      ],

                                      [
                                          ElevationServer.FILE_CONTENT,
                                          {
                                              label: 'Use File Elevation Data',
                                              id:     ElevationServer.FILE_CONTENT,
                                              icon:   faFileWaveform,
                                              origin: true,
                                          },
                                      ],
        ]
    )

    static SERVERS = new Map(
        [
            [
                ElevationServer.OPEN_ELEVATION,
                {
                    label: 'From Open-Elevation (Worldwide, 30m)',
                    id:    ElevationServer.OPEN_ELEVATION,
                    doc:   'https://github.com/Jorl17/open-elevation/blob/master/docs/api.md',
                    url:   'https://api.open-elevation.com/api/v1/lookup',
                    icon:  faMapLocation,
                },
            ],

            [
                ElevationServer.IGN_GEOPORTAIL,
                {
                    label:       'From IGN GeoPortail (France, 2.5m)',
                    id:          'ign-geoportail',
                    doc:         'https://geoservices.ign.fr/documentation/services/services-deprecies/calcul-altimetrique-rest',
                    url:         'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json',
                    maxPerQuery: 5000,
                    icon:        faMapLocation,
                },
            ],
        ],
    )

    static ERROR_DATA = -99999.0
    static WRONG_DATA_ERROR = new Error('The data is inconsistent. <br/>Elevation Server data probably not available for this part of the globe!')

    constructor(id) {
        // Get the right info
        this.instance = ElevationServer.getServer(id)
        // Fix missing attributes
        this.instance.maxPerQuery = this.instance?.maxPerQuery ?? 10000000
        this.fetchElevation = null
    }

    static getServer = (id) => {
        return ElevationServer.SERVERS.get(id) ?? ElevationServer.FAKE_SERVERS.get(id)
    }


    /**
     *
     * @param coordinates = [{lat,lon},...]
     *
     * @return {data|errors}
     *      an object with
     *        data:[{lon,lat,elevations}]
     *        or
     *        errors:[error]
     */
    getElevation = (coordinates, origin = []) => {
        return new Promise((resolve, reject) => {
        if (this.instance.id !== ElevationServer.NONE) {

            // According selected option, we set the right mthode to call
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

            // We cut the array by slice of maxPerQuery
            for (let cursor = 0; cursor < coordinates.length; cursor += this.instance.maxPerQuery) {
                chunks[0].push(coordinates.slice(cursor, cursor + this.instance.maxPerQuery))
                chunks[1].push(origin.slice(cursor, cursor + this.instance.maxPerQuery))
            }

            // Now let's run queries in parallel
            let promises = chunks[0].map((coordinates, index) => this.fetchElevation(coordinates, chunks[1][index]))

            // then wait they are resolved
            return Promise.allSettled(promises).then((results) => {
                                                  const data = {
                                                      coordinates: [],
                                                      errors:      [],
                                                  }
                                                  results.forEach(result => {
                                                      if (result.status === 'fulfilled') {
                                                          if (result.value.coordinates) {
                                                              data.coordinates.push(...result.value.coordinates)
                                                          }
                                                          if (result.value.errors) {
                                                              data.errors.push(result.value.errors)
                                                          }
                                                      }
                                                      else { // rejected or undefined
                                                          data.errors = result?.reason?.errors ?? result?.errors
                                                      }
                                                  })

                                                  if (data.errors && data.errors.length > 0) {
                                                      reject({errors: data.errors})
                                                  }
                                                  else {
                                                      resolve({
                                                                  coordinates: data.coordinates,
                                                                  errors:      null,
                                                              })
                                                  }
                                              },
            ).catch((error) => {
                reject({
                           errors: error,
                       })
            })
        }
        // Nothing to do, return coordinates without change
            resolve({
                        coordinates: coordinates,
                        errors:      null,
                    })
        })
    }

    /**
     * Get elevation from IGN Geo Portail
     *
     * @param coordinates
     * @return {Promise<{data: []} | {error: *}>}
     */
    static fetchIGNGeoportail = async (coordinates) => {

        // Get latitudes and Longitude
        const lat=[],lon=[]
        coordinates.forEach(coordinate => {
            lon.push(coordinate[0])
            lat.push(coordinate[1])
        })

        // Then build the payload
        const payload = {
            lon:   lon.join('|'),
            lat:lat.join('|'),
            zonly:"true",
            resource:'ign_rge_alti_wld'
        }

        return new Promise((resolve, reject) => {
            axios.post(ElevationServer.SERVERS.get(ElevationServer.IGN_GEOPORTAIL).url, payload)
                .then(function (response) {
                    const data = []
                    response.data.elevations.forEach((point, index) => {
                        if (point === ElevationServer.ERROR_DATA) {
                            throw ElevationServer.WRONG_DATA_ERROR
                        }
                        data.push([lon[index], lat[index], point])
                    })
                    resolve({coordinates: data})
                })
                .catch(error => {
                    reject({errors: [error]})
                })
        })
    }

    /**
     * Get elevation from Open Elevation
     *
     * @param coordinates
     * @return {Promise<{data: []} | {error: *}>}
     */
    static fetchOpenElevation = async (coordinates) => {

        const payload = {locations: []}
        coordinates.forEach(coordinate => {
            payload.locations.push({
                                       longitude: coordinate[0],
                                       latitude:  coordinate[1],
                                   })
        })

        return new Promise((resolve, reject) => {
            axios({
                      method:  'post',
                      url:     ElevationServer.SERVERS.get(ElevationServer.OPEN_ELEVATION).url,
                      data:    payload,
                      headers: {
                          'content-type': 'application/json',
                          'Accept':       'application/json',
                      },
                  })
                .then(function (response) {
                    const data = []
                    response.data.results.forEach(point => {
                        data.push([point.longitude, point.latitude, point.elevation])
                    })
                    resolve({coordinates: data})
                })
                .catch(error => {
                    reject({errors: [error]})
                })
        })
    }
    /**
     * Clear elevation data
     *
     * @param coordinates
     * @return {Promise<{data: *[]}>}
     */
    static clearElevation = async (coordinates) => {
        const data = []
        coordinates.forEach(coordinate => {
            if (coordinate.length > 2) {
                coordinate.pop()
            }
            data.push(coordinate)
        })
        return new Promise((resolve) => {
            resolve ({coordinates: data})
        })
    }

    /**
     * Reset Elevations to file content when loaded
     *
     * @param coordinates
     * @param origin
     * @return {Promise<{data: *[]}>}
     */
    static resetToFileElevation = async (coordinates, origin) => {
        const data = []
        coordinates.forEach((coordinate, index) => {
            coordinate[2] = origin[index][2]
            data.push(coordinate)
        })
            return new Promise((resolve) => {
                resolve({coordinates: data})
            })
    }
}