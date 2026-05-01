/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
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
     * Stack history to manage stacked drawers.
     * @private
     * @type {Array<Object>}
     */
    #stack = []

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

    get drawerRoot() {
        return typeof document !== 'undefined' ? document.getElementById('drawer-root') : null
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
     * Checks if the specified drawer is currently in a stacked state.
     * A drawer is stacked if it's currently open and there's history in the stack.
     *
     * @param {string} id
     * @returns {boolean}
     */
    isStacked = (id) => {
        return this.drawers.open === id && this.#stack.length > 0
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
        if (!this.isCurrent(id)) {
            return true
        }

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
     * Pushes current state to the stack if stacked option is true.
     * @param {string} id
     * @param {Object} [options]
     */
    open = (id, options = {}) => {
        if (options.stacked && ui.drawers.open && ui.drawers.open !== id) {
            this.#stack.push({
                                 id:                  ui.drawers.open,
                                 action:              ui.drawers.action,
                                 entity:              ui.drawers.entity,
                                 suppressFocusOnOpen: ui.drawers.suppressFocusOnOpen,
                             })
        }
        else if (!options.stacked) {
            this.#stack = []
        }

        ui.drawers.open = id
        ui.drawers.action = options.action ?? ''
        ui.drawers.entity = options.entity ?? null
        ui.drawers.suppressFocusOnOpen = Array.isArray(options.suppressFocusOnOpen) && options.suppressFocusOnOpen.length === 0
                                         ? false
                                         : options.suppressFocusOnOpen ?? false

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

    consumeSuppressFocusOnOpen = (target) => {
        const suppressedTarget = ui.drawers.suppressFocusOnOpen

        if (Array.isArray(suppressedTarget)) {
            const targetIndex = suppressedTarget.indexOf(target)
            const wildcardIndex = suppressedTarget.indexOf(true)
            const matchIndex = targetIndex >= 0 ? targetIndex : wildcardIndex

            if (matchIndex === -1) {
                return false
            }

            const nextTargets = suppressedTarget.filter((_, index) => index !== matchIndex)
            ui.drawers.suppressFocusOnOpen = nextTargets.length ? nextTargets : false
            return true
        }

        const shouldSuppress = suppressedTarget === true || suppressedTarget === target

        if (shouldSuppress) {
            ui.drawers.suppressFocusOnOpen = false
        }

        return shouldSuppress
    }

    /**
     * Closes the current drawer.
     * Restores the previous drawer from the stack if available.
     */
    close = () => {
        if (this.#stack.length > 0) {
            const previous = this.#stack.pop()

            ui.drawers.open = previous.id
            ui.drawers.action = previous.action
            ui.drawers.entity = previous.entity
            ui.drawers.suppressFocusOnOpen = previous.suppressFocusOnOpen ?? false

            const tabToActivate = this.#tabs.get(previous.id)
            if (tabToActivate) {
                this.openTab(tabToActivate)
            }
        }
        else {
            document.activeElement?.blur()
            ui.drawers.open = null
            ui.drawers.entity = null
            ui.drawers.action = null
            ui.drawers.suppressFocusOnOpen = false
        }
    }

    /**
     * Closes every drawer immediately and clears the stacked history.
     * Useful for floating tools/widgets that must not reserve drawer space.
     */
    forceClose = () => {
        document.activeElement?.blur()
        this.#stack = []
        ui.drawers.open = null
        ui.drawers.entity = null
        ui.drawers.action = null
        ui.drawers.suppressFocusOnOpen = false
    }

    /**
     * Verifies if an event originates from a drawer element.
     * @param {Event} event
     * @returns {boolean}
     */
    check = (event) => {
        if (event.target.nodeName !== 'WA-DRAWER') {
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
        document.querySelectorAll('wa-drawer').forEach((drawer) => {
            drawer.addEventListener('mouseleave', this.mouseLeave)
            drawer.addEventListener('mouseenter', this.mouseEnter)

            drawer.addEventListener('wa-after-show', () => {
                const event = new CustomEvent('drawer-open', {
                    detail: {drawerId: drawer.id},
                    bubbles: true,
                    composed: true,
                })
                drawer.dispatchEvent(event)
            })

            const tabgroups = drawer.querySelectorAll('wa-tab-group')
            tabgroups.forEach(tabgroup => {
                tabgroup.addEventListener('wa-tab-show', (event) => {
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
            document.querySelectorAll(`wa-drawer[id="${this.drawers.open}"] wa-tab-group`),
        )

        for (const tabGroup of tabGroups) {
            const tab = tabGroup.querySelector(`wa-tab[panel="${activeTab}"]`)
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
