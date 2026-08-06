/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDBManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-26
 * Last modified: 2026-01-26
 *
 *
 * Copyright © 2026 LGS1920
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
     *
     * MODIFICATION: Cette classe reste agnostique - elle ne fait QUE stocker les données.
     * Les calculs de conversion pixels->ratios sont faits dans WidgetCore.preparePositionDataForStorage()
     *
     * Les données stockées contiennent maintenant:
     * - leftRatio: Position left en pourcentage (%) par rapport au conteneur
     * - topRatio: Position top en pourcentage (%) par rapport au conteneur
     * - Au lieu de left/top en pixels comme avant
     *
     * @param {string} widgetId - The widget ID
     * @param {Object} positionData - Position data to store (already formatted with ratios)
     * @returns {Promise<void>}
     */
    saveWidgetPosition = async (widgetId, positionData) => {
        await lgs.db.lgs1920.put(widgetId, positionData, WIDGETS_STORE, positionData.ttl)
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
