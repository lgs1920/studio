import { km, mile }    from '@Utils/UnitUtils'
import { foot, meter } from '../../Utils/UnitUtils'

export class Utils {

    /**
     *
     * @param type {number} Plot type
     */
    static prepareData = (type = HEIGHT_DISTANCE) => {
        if (vt3d.theJourney === null) {
            return
        }

        let data = []
        vt3d.theJourney.tracks.forEach((track, slug) => {
            let distance = 0
            const line = {data: []}
            let units = []

            // For each typeof chart and according to units System, se set the units to each axis
            switch (type) {
                case HEIGHT_DISTANCE :
                    units = {
                        x: [km, mile],
                        y: [meter, foot],
                    }
                    break
            }

            track.metrics.points.forEach(point => {
                distance += point.distance
                let graph = {}
                switch (type) {
                    case HEIGHT_DISTANCE : {
                        graph.x = __.convert(distance).to(units.x[vt3d.configuration.unitsSystem])
                        graph.y = __.convert(point.altitude).to(units.y[vt3d.configuration.unitsSystem])
                    }
                }
                line.data.push(graph)

            })
            data.push(line)
        })

        return data
    }
}

export const HEIGHT_DISTANCE = 0