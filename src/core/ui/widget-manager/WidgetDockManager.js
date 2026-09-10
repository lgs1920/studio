/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDockManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {REPLAY_TIMELINE_WIDGET} from '@Core/constants'

export const DOCKED_WIDGET_DEFAULT_SIZE = 320
export const DOCKED_WIDGET_MIN_SIZE = 180
export const DOCKED_WIDGET_MAX_SIZE = 720
const DOCKED_WIDGET_MAX_VIEWPORT_RATIO = 0.9

const DOCKABLE_WIDGET_IDS = new Set([REPLAY_TIMELINE_WIDGET])

/**
 * Return the persisted dock settings, creating the default structure when needed.
 *
 * @returns {Object|null} Mutable dock settings or null when settings are unavailable.
 */
const getDockSettings = () => {
    const widgetsSettings = lgs?.settings?.ui?.widgets
    if (!widgetsSettings) {
        return null
    }

    if (!widgetsSettings.dock) {
        widgetsSettings.dock = {
            id:   null,
            size: DOCKED_WIDGET_DEFAULT_SIZE,
        }
    }

    return widgetsSettings.dock
}

/**
 * Normalize persisted widget dimensions and scale values.
 *
 * @param {Object|null|undefined} dimensions - Logical widget dimensions.
 * @param {Object|null|undefined} scale - Widget scale values.
 * @returns {{dimensions: {width: number, height: number}, scale: {x: number, y: number}}|null} Normalized layout or null.
 */
const normalizeWidgetDimensions = (dimensions, scale) => {
    const width = Number(dimensions?.width)
    const height = Number(dimensions?.height)
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return null
    }

    const scaleX = Number(scale?.x)
    const scaleY = Number(scale?.y)
    return {
        dimensions: {width, height},
        scale: {
            x: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
            y: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
        },
    }
}

/**
 * Capture the current widget layout before it is mounted in the dock.
 *
 * @param {string} widgetId - Widget instance identifier.
 * @returns {{dimensions: {width: number, height: number}, scale: {x: number, y: number}}|null} Captured layout or null.
 */
const resolveWidgetDimensions = widgetId => {
    const config = __?.ui?.widgetManager?.getWidgetConfig?.(widgetId)
    return normalizeWidgetDimensions(config?.dimensions, config?.scale)
}

/**
 * Convert a stored logical widget layout to effective pixel dimensions.
 *
 * @param {Object|null|undefined} snapshot - Stored dock layout.
 * @returns {{width: number, height: number}|null} Effective dimensions or null.
 */
const resolveEffectiveDimensions = snapshot => {
    const normalized = normalizeWidgetDimensions(snapshot?.dimensions, snapshot?.scale)
    if (!normalized) {
        return null
    }

    return {
        width:  Math.round(normalized.dimensions.width * normalized.scale.x),
        height: Math.round(normalized.dimensions.height * normalized.scale.y),
    }
}

/**
 * Resolve the maximum dock height allowed by the current viewport.
 *
 * @returns {number} Maximum dock height in pixels.
 */
export const getDockedWidgetMaxSize = () => {
    if (typeof window === 'undefined' || !Number.isFinite(window.innerHeight) || window.innerHeight <= 0) {
        return DOCKED_WIDGET_MAX_SIZE
    }

    return Math.max(DOCKED_WIDGET_MIN_SIZE, Math.floor(window.innerHeight * DOCKED_WIDGET_MAX_VIEWPORT_RATIO))
}

/**
 * Clamp a dock height between the absolute minimum and viewport maximum.
 *
 * @param {*} value - Requested dock height.
 * @param {number} [fallback=DOCKED_WIDGET_DEFAULT_SIZE] - Fallback height.
 * @param {number} [maximum=getDockedWidgetMaxSize()] - Maximum height.
 * @returns {number} Clamped dock height in pixels.
 */
export const normalizeDockSize = (value, fallback = DOCKED_WIDGET_DEFAULT_SIZE, maximum = getDockedWidgetMaxSize()) => {
    const numericValue = Number(value)
    const numericFallback = Number(fallback)
    const baseValue = Number.isFinite(numericValue) ? numericValue : numericFallback
    const safeValue = Number.isFinite(baseValue) ? baseValue : DOCKED_WIDGET_DEFAULT_SIZE
    const safeMaximum = Math.max(DOCKED_WIDGET_MIN_SIZE, Number(maximum) || DOCKED_WIDGET_MAX_SIZE)
    return Math.round(Math.min(Math.max(safeValue, DOCKED_WIDGET_MIN_SIZE), safeMaximum))
}

/**
 * Check whether a widget identifier belongs to the dockable widget allowlist.
 *
 * @param {string|null|undefined} widgetId - Widget instance identifier.
 * @returns {boolean} True when the widget type is dockable.
 */
export const isDockableWidgetId = widgetId => {
    const baseId = typeof widgetId === 'string' ? widgetId.split('#')[0] : widgetId
    return DOCKABLE_WIDGET_IDS.has(baseId)
}

/**
 * Return the identifier of the currently docked widget.
 *
 * @returns {string|null} Docked widget identifier or null.
 */
export const getDockedWidgetId = () => lgs?.stores?.ui?.widget?.docked?.id ?? null

/**
 * Return the effective persisted dimensions of a docked widget.
 *
 * @param {string|null|undefined} [widgetId] - Widget instance identifier.
 * @returns {{width: number, height: number}|null} Effective dimensions or null.
 */
export const getDockedWidgetDimensions = (widgetId = getDockedWidgetId()) => {
    if (!widgetId) {
        return null
    }

    const docked = lgs?.stores?.ui?.widget?.docked
    const settings = getDockSettings()
    const snapshot = docked?.id === widgetId
                  ? docked
                  : settings?.id === widgetId
                      ? settings
                      : null
    return resolveEffectiveDimensions(snapshot)
}

/**
 * Check whether a widget can be moved into the dock.
 *
 * @param {string|null|undefined} widgetId - Widget instance identifier.
 * @returns {boolean} True when the widget is eligible and the dock is free.
 */
export const canDockWidget = widgetId => {
    if (!isDockableWidgetId(widgetId) || getDockedWidgetId()) {
        return false
    }

    const config = __?.ui?.widgetManager?.getWidgetConfig?.(widgetId)
    return Boolean(config?.contextMenu?.canDockable === true && !config.mandatory)
}

/**
 * Move an eligible widget into the dock and capture its pre-dock layout.
 *
 * @param {string} widgetId - Widget instance identifier.
 * @returns {boolean} True when the widget was docked.
 */
export const dockWidget = widgetId => {
    if (!canDockWidget(widgetId)) {
        return false
    }

    const settings = getDockSettings()
    const size = normalizeDockSize(settings?.size)
    const dimensions = resolveWidgetDimensions(widgetId)
    const docked = {id: widgetId, size}
    if (dimensions) {
        Object.assign(docked, dimensions)
    }
    lgs.stores.ui.widget.docked = docked
    if (settings) {
        settings.id = widgetId
        settings.size = size
        if (dimensions) {
            Object.assign(settings, dimensions)
        }
    }
    lgs.stores.ui.widget.current = {id: null}
    return true
}

/**
 * Remove a widget from the dock and select it on the scene.
 *
 * @param {string|null|undefined} [widgetId] - Widget instance identifier.
 * @returns {boolean} True when the widget was undocked.
 */
export const undockWidget = (widgetId = getDockedWidgetId()) => {
    if (!widgetId || getDockedWidgetId() !== widgetId) {
        return false
    }

    const settings = getDockSettings()
    const size = normalizeDockSize(lgs.stores.ui.widget.docked?.size ?? settings?.size)
    lgs.stores.ui.widget.docked = {id: null, size}
    if (settings) {
        settings.id = null
        settings.size = size
        delete settings.dimensions
        delete settings.scale
    }
    lgs.stores.ui.widget.current = {id: widgetId}
    return true
}

/**
 * Update and persist the dock height.
 *
 * @param {*} value - Requested dock height.
 * @returns {number} Clamped dock height in pixels.
 */
export const setDockSize = value => {
    const settings = getDockSettings()
    const size = normalizeDockSize(value, lgs.stores.ui.widget.docked?.size ?? settings?.size)
    lgs.stores.ui.widget.docked.size = size
    if (settings) {
        settings.size = size
    }
    return size
}

/**
 * Restore a supported docked widget from persisted settings.
 *
 * @returns {string|null} Restored widget identifier or null.
 */
export const hydrateDockedWidget = () => {
    const settings = getDockSettings()
    if (!settings || !isDockableWidgetId(settings.id)) {
        if (settings) {
            settings.id = null
            settings.size = normalizeDockSize(settings.size)
            delete settings.dimensions
            delete settings.scale
        }
        lgs.stores.ui.widget.docked = {id: null, size: normalizeDockSize(settings?.size)}
        return null
    }

    const size = normalizeDockSize(settings.size)
    settings.size = size
    const dimensions = normalizeWidgetDimensions(settings.dimensions, settings.scale)
    const docked = {id: settings.id, size}
    if (dimensions) {
        Object.assign(docked, dimensions)
    }
    lgs.stores.ui.widget.docked = docked
    return settings.id
}
