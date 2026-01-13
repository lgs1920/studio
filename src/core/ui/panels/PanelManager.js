/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-13
 * Last modified: 2026-01-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ui } from '@Stores/ui'

/**
 * Manages the state and interactions of drawers within the application.
 *
 * @class PanelManager
 * @singleton
 */
export class PanelManager {
    /**
     * Indicates whether the mouse is currently over a drawer element.
     * @type {boolean}
     */
    over = false

    /**
     * Stores the active tab for each drawer, mapped by drawer ID.
     * @private
     * @type {Map<string, string>}
     */
    #tabs = new Map()

    /**
     * Creates a new instance of PanelManager or returns the existing instance.
     * Implements the singleton pattern.
     *
     * @constructor
     */
    constructor() {
        if (PanelManager.instance) {
            return PanelManager.instance
        }

        PanelManager.instance = this
    }

    /**
     * Accessor for the drawers store via the global ui variable.
     * @returns {Object}
     */
    get drawers() {
        return ui.drawers
    }

    /**
     * Updates the drawers state in the store.
     * @param {Object} value
     */
    set drawers(value) {
        Object.assign(ui.drawers, value)
    }

    /**
     * Gets the currently active tab for the open drawer.
     * @returns {string|undefined}
     */
    get tab() {
        return this.#tabs.get(this.drawers.open)
    }

    /**
     * Sets the active tab for the currently open drawer.
     * @param {string} tab
     */
    set tab(tab) {
        this.#tabs.set(this.drawers.open, tab)
    }

    /**
     * Checks if the specified drawer is currently open.
     * @param {string} id
     * @returns {boolean}
     */
    isCurrent = (id) => {
        return this.drawers.open === id
    }

    /**
     * Validates if a drawer can be opened or updated.
     * Returns true if:
     * - The requested ID is not the current one (handles null initial state).
     * - The ID is the same but the entity has changed.
     *
     * @param {string} id - Target drawer ID
     * @param {string|number|null} [entity] - Target entity ID
     * @returns {boolean}
     */
    canOpen = (id, entity = null) => {
        // If drawer is not open or a different one is requested
        if (!this.isCurrent(id)) {
            return true
        }

        // If it's the same drawer, only allow re-opening if the entity is different
        return entity !== null && ui.drawers.entity !== entity
    }

    /**
     * Toggles drawer state based on ID and entity context.
     * @param {string} id
     * @param {Object} [options]
     */
    toggle = (id, options = {}) => {
        const entity = options.entity ?? null

        if (this.canOpen(id, entity)) {
            this.open(id, options)
        }
        else {
            this.close()
        }
    }

    /**
     * Configures and displays the specified drawer.
     * @param {string} id
     * @param {Object} [options]
     */
    open = (id, options = {}) => {
        ui.drawers.open = id
        ui.drawers.action = options.action ?? ''
        ui.drawers.entity = options.entity ?? null

        let tabToActivate = null

        if (options.tab && options.tab !== 'current' && options.tab !== 'default') {
            tabToActivate = options.tab
            this.tab = tabToActivate
        }
        else if (options.tab === 'current' || (!options.tab && this.#tabs.has(id))) {
            tabToActivate = this.#tabs.get(id)
        }

        if (tabToActivate) {
            this.openTab(tabToActivate)
        }
    }

    /**
     * Closes the drawer and resets store state.
     */
    close = () => {
        document.activeElement?.blur()
        ui.drawers.open = null
        ui.drawers.entity = null
    }

    /**
     * Verifies if an event originates from a drawer element.
     * @param {Event} event
     * @returns {boolean}
     */
    check = (event) => {
        if (event.target.nodeName !== 'SL-DRAWER') {
            event.preventDefault()
            return false
        }
        return true
    }

    /**
     * Interaction state handlers.
     */
    mouseLeave = () => {
        this.over = false
    }

    mouseEnter = () => {
        this.over = true
    }

    /**
     * Initializes event listeners for drawers and their nested tab groups.
     */
    attachEvents = () => {
        document.querySelectorAll('sl-drawer').forEach((drawer) => {
            drawer.addEventListener('mouseleave', this.mouseLeave)
            drawer.addEventListener('mouseenter', this.mouseEnter)

            drawer.addEventListener('sl-after-show', () => {
                const event = new CustomEvent('drawer-open', {
                    detail: {drawerId: drawer.id},
                    bubbles: true,
                    composed: true,
                })
                drawer.dispatchEvent(event)
            })

            const tabgroups = drawer.querySelectorAll('sl-tab-group')
            tabgroups.forEach(tabgroup => {
                tabgroup.addEventListener('sl-tab-show', (event) => {
                    this.tab = event.detail.name
                })
            })
        })
    }

    /**
     * Resets the active action in the store.
     */
    clean = () => {
        ui.drawers.action = null
    }

    /**
     * Updates the DOM to show a specific tab panel.
     * @param {string} [tabName]
     */
    openTab = (tabName) => {
        const activeTab = tabName ?? this.#tabs.get(this.drawers.open)

        if (!activeTab) {
            return
        }

        const tabGroups = Array.from(
            document.querySelectorAll(`sl-drawer[id="${this.drawers.open}"] sl-tab-group`),
        )

        for (const tabGroup of tabGroups) {
            const tab = tabGroup.querySelector(`sl-tab[panel="${activeTab}"]`)
            if (tab) {
                tabGroup.show(activeTab)
            }
        }
    }

    /**
     * Predicate for tab activity status.
     * @param {string} tabName
     * @returns {boolean}
     */
    tabActive = (tabName) => {
        if (!this.drawers.open) {
            return false
        }
        return this.#tabs.get(this.drawers.open) === tabName
    }

    /**
     * Helper to set open state.
     * @param {string|null} id
     */
    setOpen(id) {
        ui.drawers.open = id
    }

    /**
     * Helper to set action state.
     * @param {string|null} action
     */
    setAction(action) {
        ui.drawers.action = action
    }
}