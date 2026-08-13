/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widgetScaleUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const WIDGET_SCALE_CHANGED_EVENT = 'lgs-widget-scale-changed'

const MIN_WIDGET_SCALE = 0.01

export const normalizeWidgetScale = (scale = {}) => {
    const x = Number(scale.x)
    const y = Number(scale.y)

    return {
        x: Number.isFinite(x) && x > 0 ? x : 1,
        y: Number.isFinite(y) && y > 0 ? y : 1,
    }
}

export const getWidgetScaleEffective = (scale = {}) => {
    const normalized = normalizeWidgetScale(scale)
    const effective = (Math.abs(normalized.x) + Math.abs(normalized.y)) / 2

    return Math.max(MIN_WIDGET_SCALE, effective)
}

export const getWidgetScaleCorrection = (scale = {}) => 1 / getWidgetScaleEffective(scale)

export const resolveWidgetScaleCorrection = (id) => {
    if (!id || typeof __ === 'undefined') {
        return 1
    }

    const config = __.ui.widgetManager.getWidgetConfig(id)
    return getWidgetScaleCorrection(config?.scale)
}

export const applyWidgetScaleVariables = (element, scale = {}) => {
    if (!element) {
        return
    }

    const normalized = normalizeWidgetScale(scale)
    const effective = getWidgetScaleEffective(normalized)
    const correction = getWidgetScaleCorrection(normalized)

    element.style.setProperty('--lgs-widget-scale-x', normalized.x)
    element.style.setProperty('--lgs-widget-scale-y', normalized.y)
    element.style.setProperty('--lgs-widget-scale-effective', effective)
    element.style.setProperty('--lgs-widget-scale-correction', correction)

    const id = element.getAttribute?.('data-widget-id') ?? null
    const detail = {
        id,
        correction,
        effective,
        scale: normalized,
    }

    element.dispatchEvent(new CustomEvent(WIDGET_SCALE_CHANGED_EVENT, {
        bubbles:  true,
        composed: true,
        detail,
    }))
    window.dispatchEvent(new CustomEvent(WIDGET_SCALE_CHANGED_EVENT, {detail}))
}
