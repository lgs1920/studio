import {Color, GpxDataSource} from 'cesium'
import {FileUtils}            from './FileUtils.js'
import {UINotifier}           from './UINotifier'

export const ACCEPTED_TRACK_FILES = ['.geojson', '.kml', '.gpx', '.kmz']

export class TrackUtils {

    static MIMES = {
        gpx: ['application/gpx+xml', 'vnd.gpxsee.map+xml', 'application/octet-stream'],
        geojson: ['application/geo+json', 'application/json'],
        kml: ['vnd.google-earth.kml+xml'],
        kmz: ['vnd.google-earth.kmz'],
    }

    static async loadTrack() {
        return FileUtils.uploadFileFromFrontEnd({
            accepted: ACCEPTED_TRACK_FILES,
            mimes: TrackUtils.MIMES,
        }).then(file => {
            if (file) {
                vt3DContext.addTrack(file.name)
            }
            return file
        })
    }

    static showTrack = (track) => {
        const parser = new DOMParser()
        const content = parser.parseFromString(track.content, 'text/xml')
        try {
            window.vt3DContext.viewer.dataSources
                .add(
                    GpxDataSource.load(content, {
                        clampToGround: true,
                        trackColor: Color.DARKRED,
                        routeColor: Color.DARKBLUE,
                    }),
                )
                .then(function (dataSource) {
                    UINotifier.notifySuccess({
                        caption: 'Loaded!',
                        text: `The track <strong>${track.name}</strong> has been loaded and displayed on the map.`,
                    })
                    window.vt3DContext.viewer.zoomTo(dataSource.entities)
                }).catch(error => {
                UINotifier.notifyError({
                    caption: `An error occurs during loading <strong>${track.name}<strong>!`,
                    text: error.message,
                })
            })
        } catch (error) {
            UINotifier.notifyError({
                caption: `An error occurs during loading <strong>${track.name}<strong>!`,
                text: error.message,
            })
        }
    }
}
