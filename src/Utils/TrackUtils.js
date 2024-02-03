import {FileUtils} from './FileUtils.js'
import {GpxDataSource,Color} from "cesium";
//import * as geojson from 'mapbox/togeojson'

export class TrackUtils {

    static ACCEPTED_TRACK_FILES=['.zip','.kml','.gpx','.kmz']

    static async loadTrack() {
        return FileUtils.uploadFileFromFrontEnd(TrackUtils.ACCEPTED_TRACK_FILES).then(file => {
            if (file) {
                vt3DContext.addTrack(file.name)
            }
            return file
        })
    }

    static showTrack = (track) => {
        const parser = new DOMParser();
        const content= parser.parseFromString(track.content, "text/xml");
        console.log(content)
        window.vt3DContext.viewer.dataSources
            .add(
                GpxDataSource.load(content, {
                    clampToGround: true,
                    trackColor:Color.DARKRED,
                    routeColor: Color.DARKBLUE
                })

            )
            .then(function (dataSource) {
                console.log({dataSource});
                try {
                  //  window.vt3DContext.viewer.zoomTo(dataSource.entities);
                } catch (e) {

                }
            });
    }
}
