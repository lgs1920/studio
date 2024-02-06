import {gpx, kml}                 from '@tmcw/togeojson'
import {Color, GeoJsonDataSource} from 'cesium'
import {FileUtils}                from './FileUtils.js'
import {UINotifier}               from './UINotifier'

export const ACCEPTED_TRACK_FILES = ['.geojson', '.kml', '.gpx' /* TODO '.kmz'*/]

export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'],
        // kmz: ['vnd.google-earth.kmz'], //TODO KMZ files
    }

    /**
     * Load a track file
     *
     * return
     *
     * @return {Promise<FileStringResult>}
     */
    static async loadTrack() {
        return FileUtils.uploadFileFromFrontEnd({
            accepted: ACCEPTED_TRACK_FILES,
            mimes: TrackUtils.MIMES,
        })
    }

    /**
     * Show track on the map
     *
     * @param track
     * @return {Promise<void>}
     */
    static showTrack = async (track) => {
        let dataSource
        const configuration = window.vt3d.configuration

        const trackStroke = {
            color: Color.fromCssColorString(configuration.track.color),
            width: configuration.track.width,
        }
        const routeStroke = {
            color: Color.fromCssColorString(configuration.route.color),
            width: configuration.route.width,
        }

        const commonOptions = {
            clampToGround: true,
            name: track.name,
        }
        /**
         * Load DataSource and add it
         *
         * Available formats are : gpx,kml,kmz,geojson
         *
         * For convenient reasons, we translate kml and gpx to GeoJson formt
         *
         */
        try {
            let content = ''
            switch (track.extension) {
                case 'gpx':
                    content = gpx(new DOMParser().parseFromString(track.content, 'text/xml'))
                    break
                case 'kmz' :
                // TODO unzip to get kml. but what to do with the assets files that are sometimes embedded
                case 'kml':
                    content = kml(new DOMParser().parseFromString(track.content, 'text/xml'))
                    break
                case 'geojson' :
                    content = JSON.parse(track.content)
            }
            dataSource = await GeoJsonDataSource.load(content, {
                ...commonOptions,
                stroke: trackStroke.color,
                strokeWidth: trackStroke.width,
            })

            /**
             * Then add and display data source
             */

            //dataSource.name = `${track.name}.${track.extension}`
            window.vt3d.viewer.dataSources.add(dataSource)
                .then(function (dataSource) {
                    // Ok => we notify
                    UINotifier.notifySuccess({
                        caption: 'Loaded!',
                        text: `The track <strong>${track.name}</strong> has been loaded and displayed on the map.`,
                    })
                    window.vt3d.viewer.zoomTo(dataSource.entities)
                }).catch(error => {
                // Error => we notify
                UINotifier.notifyError({
                    caption: `An error occurs during loading <strong>${track.name}<strong>!`,
                    text: error,
                })
            })
        } catch (error) {
            console.error(error)
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${track.name}<strong>!`,
                text: error,
            })
        }
    }
}
