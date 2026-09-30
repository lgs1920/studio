/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPreparationAppearance.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-30
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Temporarily reduce the journey track opacity while Replay is being prepared.
 */

import {BufferPolyline, BufferPolylineMaterial, CallbackProperty, Color} from 'cesium'

const DEFAULT_PREPARATION_OPACITY = 0.3
const MATERIAL_COLOR_FIELDS = ['color', 'outlineColor', 'gapColor']

/**
 * Fade a material color while preserving its original color property.
 *
 * @param {Object} material - Cesium material property to fade.
 * @param {string} field - Material color field.
 * @param {number} opacity - Opacity multiplier.
 * @param {Array<Function>} restorers - Callbacks that restore changed properties.
 * @returns {void}
 */
const fadeMaterialColor = (material, field, opacity, restorers) => {
    const originalProperty = material?.[field]
    if (!originalProperty) {
        return
    }

    const getOriginalColor = time => typeof originalProperty.getValue === 'function'
        ? originalProperty.getValue(time)
        : originalProperty
    material[field] = new CallbackProperty(time => {
        const color = getOriginalColor(time)
        return color instanceof Color ? color.withAlpha(color.alpha * opacity) : color
    }, false)
    restorers.push(() => {
        material[field] = originalProperty
    })
}

/**
 * Fade all line materials in a journey's Cesium data sources.
 *
 * @param {Object|null} viewer - Cesium viewer containing journey data sources.
 * @param {Object|null} journey - Journey whose track sources should be faded.
 * @param {number} opacity - Opacity multiplier, defaulting to 0.5.
 * @returns {Function} Restore callback for the original journey appearance.
 */
export const fadeJourneyForReplayPreparation = (viewer, journey, opacity = DEFAULT_PREPARATION_OPACITY) => {
    const restorers = []
    const sources = Array.from(journey?.tracks?.values?.() ?? [])
        .flatMap(track => viewer?.dataSources?.getByName?.(track.slug) ?? [])
    const fadedMaterials = new Set()

    sources.forEach(source => {
        source.entities?.values?.forEach(entity => {
            const material = entity.polyline?.material
            if (!material || fadedMaterials.has(material)) {
                return
            }
            fadedMaterials.add(material)
            MATERIAL_COLOR_FIELDS.forEach(field => fadeMaterialColor(material, field, opacity, restorers))
        })

        const polylines = source.__lgsTrackPrimitive?.polylines
        if (!polylines) {
            return
        }
        const polyline = new BufferPolyline()
        for (let index = 0; index < polylines.primitiveCount; index += 1) {
            polylines.get(index, polyline)
            const originalMaterial = polyline.getMaterial(new BufferPolylineMaterial())
            const fadedMaterial = new BufferPolylineMaterial({
                color:        originalMaterial.color.withAlpha(originalMaterial.color.alpha * opacity),
                outlineColor: originalMaterial.outlineColor.withAlpha(originalMaterial.outlineColor.alpha * opacity),
                outlineWidth: originalMaterial.outlineWidth,
                width:        originalMaterial.width,
            })
            polyline.setMaterial(fadedMaterial)
            restorers.push(() => {
                polylines.get(index, polyline)
                polyline.setMaterial(originalMaterial)
            })
        }
    })

    viewer?.scene?.requestRender?.()
    return () => {
        restorers.reverse().forEach(restore => restore())
        viewer?.scene?.requestRender?.()
    }
}
