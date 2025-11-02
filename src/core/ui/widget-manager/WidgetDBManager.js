/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDBManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-02
 * Last modified: 2025-11-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { HOUR, WIDGETS_STORE } from '@Core/constants'

export class WidgetDBManager {

    static #instance = null
    TTL = 6 * HOUR

    /**
     * Creates or returns the singleton instance of WidgetCropper.
     * @param WidgetManager
     */
    constructor(WidgetManager) {
        if (WidgetDBManager.#instance) {
            return WidgetDBManager.#instance
        }
        WidgetDBManager.#instance = this
    }

    /**
     * Saves widget position and dimensions to the widgets DB.
     * @param {string} widgetId - The widget ID
     * @param {Object} config - Widget configuration
     * @returns {Promise<void>}
     */
    saveWidgetPosition = async (widgetId, config) => {

        const scale = config.scale || {x: 1, y: 1}
        const record = {
            id:        widgetId,
            group:     config.group || null,
            left:  config.position.left,
            top:   config.position.top,
            width:     config.cropDimensions?.width || config.dimensions.width,
            height:    config.cropDimensions?.height || config.dimensions.height,
            transient: config.transient,
            ttl:       config.ttl || null,
            scale: scale,
            ratio:    config.ratio,
            attachTo: config.attachTo,
        }
        await lgs.db.lgs1920.put(widgetId, record, WIDGETS_STORE, record.ttl)

    }

    /**
     * Retrieves widget position from the widgets DB if not expired.
     * @param {string} widgetId - The widget ID
     * @returns {Promise<Object|null>} Position data or null if not found/expired
     */
    getWidgetPosition = async widgetId => {
        return await lgs.db.lgs1920.get(widgetId, WIDGETS_STORE)
    }

    /**
     * Retrieves all widget positions for a given group from the widgets DB if not expired.
     * @param {string} groupId - The group ID
     * @returns {Promise<Object[]>} Array of position data for the group
     */
    getWidgetsByGroup = async groupId => {
        return await lgs.db.lgs1920.findByIndex('group', groupId, WIDGETS_STORE)
    }

    /**
     * Deletes all widget positions for a given group from the widgets DB.
     * @param {string} groupId - The group ID
     * @returns {Promise<void>}
     */
    deleteWidgetsByGroup = async groupId => {
        const data = await lgs.db.lgs1920.findByIndex('group', groupId, WIDGETS_STORE)
        for (const id of data) {
            await lgs.db.lgs1920.delete(id, WIDGETS_STORE)
        }
    }

    /**
     * Deletes a single widget position from the widgets DB.
     * @param {string} widgetId - The widget ID
     * @returns {Promise<void>}
     */
    deleteWidgetPosition = async widgetId => {
        await lgs.db.lgs1920.delete(widgetId, WIDGETS_STORE)
    }
}