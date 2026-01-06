/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: KalmanFilter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

    // From https://stackoverflow.com/questions/1134579/smooth-gps-data
//--------------------------------------------------------------------

export class GPSKalmanFilter {
    constructor(decay = 3) {
        this.decay = decay
        this.variance = -1
        this.minAccuracy = 1
    }

    process(lng, lat, accuracy, timestampInMs) {
        if (accuracy < this.minAccuracy) accuracy = this.minAccuracy

        if (this.variance < 0) {
            this.timestampInMs = timestampInMs
            this.lat = lat
            this.lng = lng
            this.variance = accuracy * accuracy
        } else {
            const timeIncMs = timestampInMs - this.timestampInMs

            if (timeIncMs > 0) {
                this.variance += (timeIncMs * this.decay * this.decay) / 1000
                this.timestampInMs = timestampInMs
            }

            const _k = this.variance / (this.variance + (accuracy * accuracy))
            this.lat += _k * (lat - this.lat)
            this.lng += _k * (lng - this.lng)

            this.variance = (1 - _k) * this.variance
        }

        return [this.lng, this.lat]
    }
}