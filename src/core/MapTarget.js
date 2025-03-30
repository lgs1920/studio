/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-24
 * Last modified: 2025-02-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapElement } from '@Core/MapElement'
import { v4 as uuid } from 'uuid'

export class MapTarget extends MapElement {

    longitude
    latitude
    height

    /**
     * Initializes a new instance
     *
     * @param element  the element type (poi, journey,..) this target is derived from
     *
     * @param {Object} options - The options object containing initial properties.
     */
    constructor(element, options = null) {
        super(element)
        // If there is no id provided, we generate one
        this.id = options?.id ? options.id.toString() : uuid()
        this.slug = this.id

        this.longitude = options.longitude
        this.latitude = options.latitude
        this.height = options.height

    }
}