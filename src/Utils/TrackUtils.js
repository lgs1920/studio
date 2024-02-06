import {Color, GeoJsonDataSource, GpxDataSource, KmlDataSource} from 'cesium'
import {FileUtils}                                              from './FileUtils.js'
import {UINotifier}                                             from './UINotifier'

export const ACCEPTED_TRACK_FILES = ['.geojson', '.kml', '.gpx', '.kmz']

export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'],
        kmz: ['vnd.google-earth.kmz'],
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
        const trackColor = Color.DARKRED
        const routeColor = Color.DARKBLUE
        const commonOptions = {
            clampToGround: true,
            name: track.name,
        }
        /**
         * Load DataSource and add it
         *
         * Available formats are : gpx,kml,kmz,geojson
         */
        try {
            switch (track.extension) {
                case 'gpx' : {
                    const parser = new DOMParser()
                    const content = parser.parseFromString(track.content, 'text/xml')
                    dataSource = await GpxDataSource.load(content, {
                        ...commonOptions,
                        trackColor: trackColor,
                        routeColor: routeColor,
                    })
                    break
                }
                case 'kml':
                case 'kmz' : {

                    const parser = new DOMParser()
                    const content = parser.parseFromString(track.content, 'text/xml')
                    console.log(parser)
                    dataSource = await KmlDataSource.load(content, {
                        ...commonOptions,
                        camera: window.vt3DContext.camera,
                        canvas: window.vt3DContext.scene.canvas,
                        screenOverlayContainer: window.vt3DContext.viewer?.container,
                    })

                    break
                }
                case 'gpx':
                case 'kml':
            }
                ':
                    console.log(JSON.parse(track.content))
                    dataSource = await GeoJsonDataSource.load(JSON.parse(track.content), {
                        ...options,
                        stroke: trackColor,
                    })
                    break
            }

            /**
             * Then add and display data source
             */

            //dataSource.name = `${track.name}.${track.extension}`
            window.vt3DContext.viewer.dataSources.add(dataSource)
                .then(function (dataSource) {
                    // Ok => we notify
                    UINotifier.notifySuccess({
                        caption: 'Loaded!',
                        text: `The track <strong>${track.name}</strong> has been loaded and displayed on the map.`,
                    })
                    window.vt3DContext.viewer.zoomTo(dataSource.entities)
                }).catch(error => {
                // Error => we notify
                UINotifier.notifyError({
                    caption: `An error occurs during loading <strong>${track.name}<strong>!`,
                    text: error,
                })
            })
        } catch (error) {
            // Error => we notify
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${track.name}<strong>!`,
                text: error,
            })
        }
    }
}
