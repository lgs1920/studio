/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetPreviewRotation.js
 *
 ******************************************************************************/

const PREVIEW_ZONE_SELECTOR = '.editor-preview-zone.lgs-widget-preview'
const PREVIEW_STAGE_SELECTOR = '[data-widget-preview-rotation-stage]'

/**
 * Applies a widget rotation directly to its editor preview stage.
 * This keeps pointer-driven rotation on the compositor path instead of forcing
 * every preview component to render through React for each Moveable event.
 *
 * @param {string} widgetId - Widget instance identifier.
 * @param {number} rotation - Rotation in degrees.
 * @returns {void}
 */
export const syncWidgetPreviewRotation = (widgetId, rotation) => {
    if (!widgetId || typeof document === 'undefined') {
        return
    }

    const numericRotation = Number(rotation)
    const resolvedRotation = Number.isFinite(numericRotation) ? numericRotation : 0
    const previewZone = Array.from(document.querySelectorAll(PREVIEW_ZONE_SELECTOR))
        .find(element => element.dataset.widgetPreviewEntity === widgetId)
    const previewStage = previewZone?.querySelector(PREVIEW_STAGE_SELECTOR)

    if (!previewStage) {
        return
    }

    previewStage.style.transform = `rotate(${resolvedRotation}deg)`
    previewStage.dataset.widgetPreviewRotation = String(resolvedRotation)
}
