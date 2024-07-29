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
     * Define some fake elevation servers  for manage some UCs
     *
     * @type {Map<null, {name: string, id: null}>}
     */
    static FAKE_SERVERS = new Map([
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
                                              label: 'Remove Current Elevation Data',
                                              id:    ElevationServer.CLEAR,
                                              icon:  faTrashCan,
                                          },
                                      ],
                                      [
                                          ElevationServer.FILE_CONTENT,
                                          {
                                              label:  'File Elevation Data',
                                              id:     ElevationServer.FILE_CONTENT,
                                              icon:   faFileWaveform,
                                              origin: true,
                                          },
                                      ],


                                  ])

    static SERVERS = new Map([
                                 ...ElevationServer.FAKE_SERVERS, ...[
            [
                ElevationServer.OPEN_ELEVATION,
                {
                    label:       'Open-Elevation (Worldwide, 30m)',
                    id:          ElevationServer.OPEN_ELEVATION,
                    doc:         'https://github.com/Jorl17/open-elevation/blob/master/docs/api.md',
                    url:         'https://api.open-elevation.com/api/v1/lookup',
                    icon:        faMapLocation,
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
                    icon:        faMapLocation,
                },
            ],

        ],
                             ])


    constructor(id) {
        // Get the right info
        this.server = ElevationServer.SERVERS.get(id)
        // Fix missing attributes
        this.server.maxPerQuery = this.server.maxPerQuery ?? 10000000
        this.fetchElevation = null
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
    getElevation = async (coordinates, origin = []) => {
        if (this.server.id !== ElevationServer.NONE) {

            // According selected option, we set the right mthode to call
            switch (this.server.id) {
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
            for (let cursor = 0; cursor < coordinates.length; cursor += this.server.maxPerQuery) {
                chunks[0].push(coordinates.slice(cursor, cursor + this.server.maxPerQuery))
                chunks[1].push(origin.slice(cursor, cursor + this.server.maxPerQuery))
            }
            // Now let's run queries in parallel
            let promises = chunks[0].map((coordinates, index) => this.fetchElevation(coordinates, chunks[1][index]))
            // then wait they are resolved
            const all = await Promise.all(promises)
            // Now return data with elevations
            const data= all.map(item => item.coordinates);
            const errors = all
                .map(item => item.error ? item.error : null)
                .filter(error => error !== null);
            if (errors.length > 0) {
                return {errors:errors}
            }
            return {coordinates:[].concat(...data)}
        }
        // Nothing to do, return coordinates without change
        return {coordinates:coordinates}
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

        return axios.post(ElevationServer.SERVERS.get(ElevationServer.IGN_GEOPORTAIL).url, payload)
            .then(function (response) {
                const data=[]
                response.data.elevations.forEach((point,index) => {
                     data.push([lon[index],lat[index],point])
                 })
                return {coordinates:data}
            })
            .catch(error =>{
                return {errors:[error]}
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
                                       longitude:  coordinate[0],
                                       latitude: coordinate[1],
                                   })
        })

        return axios.post(ElevationServer.SERVERS.get(ElevationServer.OPEN_ELEVATION).url, payload)
            .then(function (response) {
                const data=[]
                response.data.results.forEach(point => {
                    data.push([point.longitude,point.latitude,point.elevation])
                })
                return {coordinates:data}
            })
            .catch(error =>{
                return {errors:[error]}
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
        return {coordinates:data}
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
        return {coordinates: data}
    }
}