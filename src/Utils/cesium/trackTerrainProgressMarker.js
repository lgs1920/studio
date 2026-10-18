/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackTerrainProgressMarker.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-18
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Color, HeightReference} from 'cesium'

/**
 * Create a temporary, ground-clamped marker for the current anti-cliff analysis position.
 *
 * @param {object} options - Marker viewer options.
 * @param {object} [options.viewer=globalThis.lgs.viewer] - Cesium viewer that owns the temporary entity.
 * @returns {{update: (coordinate: Array<number>) => boolean, clear: () => void}} Marker lifecycle controls.
 */
export const createTrackTerrainAlignmentProgressMarker = ({viewer = globalThis.lgs?.viewer} = {}) => {
    let entity = null

    /**
     * Move the marker to a valid route coordinate.
     *
     * @param {Array<number>} coordinate - GPX longitude, latitude, and optional altitude.
     * @returns {boolean} Whether the marker was created or updated.
     */
    const update = coordinate => {
        const longitude = Number(coordinate?.[0])
        const latitude = Number(coordinate?.[1])
        if (!viewer?.entities
            || !Number.isFinite(longitude)
            || longitude < -180
            || longitude > 180
            || !Number.isFinite(latitude)
            || latitude < -90
            || latitude > 90) {
            return false
        }

        try {
            const position = Cartesian3.fromDegrees(longitude, latitude)
            if (entity) {
                entity.position = position
            }
            else {
                entity = viewer.entities.add({
                    position,
                    point: {
                        pixelSize:               15,
                        color:                   Color.CYAN,
                        outlineColor:            Color.BLACK,
                        outlineWidth:            2,
                        heightReference:         HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                })
            }

            viewer.scene?.requestRender?.()
            return Boolean(entity)
        }
        catch {
            return false
        }
    }

    /**
     * Remove the temporary entity and request one final scene render.
     *
     * @returns {void} The marker is removed when it exists.
     */
    const clear = () => {
        if (!entity) {
            return
        }

        try {
            viewer.entities.remove(entity)
            viewer.scene?.requestRender?.()
        }
        catch {
            // Marker cleanup must not interrupt Journey persistence or drawing.
        }
        finally {
            entity = null
        }
    }

    return {clear, update}
}
