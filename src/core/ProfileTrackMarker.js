/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileTrackMarker.js
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

import { POI }                   from '@Core/POI'
import { faCircle }              from '@fortawesome/pro-solid-svg-icons'
import { JUST_ICON, POI_MARKER } from '@Utils/cesium/POIUtils'
import { VerticalOrigin }        from 'cesium'

export class ProfileTrackMarker extends POI {

    constructor(options) {
        let track = options?.parent ?? lgs.theTrack
        track = (typeof track === 'string')?track:track.slug
        const profileTrackMarkerSettings = lgs.settings?.getProfile?.marker?.track ?? {}
        const POIOptions = {
            type:            JUST_ICON,
            usage: POI_MARKER,
            size:            options?.size ?? profileTrackMarkerSettings.size,
            name:  options?.name ?? `${POI_MARKER}#${track}`,
            slug: options?.slug ?? `${POI_MARKER}#${track}`,
            icon:faCircle,
            parent : track,
            coordinates:     [lgs.settings.getStarter.longitude, lgs.settings.getStarter.latitude],
            altitude:        false,
            time:            false,
            visible:         true,
            vertical: VerticalOrigin.CENTER,
            border:          options?.border?.width ?? options?.foregroundColor?.border ?? profileTrackMarkerSettings?.border?.width,
            backgroundColor: options?.border?.color ?? options?.backgroundColor ?? profileTrackMarkerSettings?.border?.color,
            foregroundColor: options?.color ?? options?.foregroundColor ?? profileTrackMarkerSettings?.color,
            drawn:options?.drawn??false
        }

        super(POIOptions)
    }

    showOnTrack = async (coordinates) => {
        if (!this.drawn) {
            await this.draw()
        }
            await this.move(coordinates)

        this.visible =true
    }

}
