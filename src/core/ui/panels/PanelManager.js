/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-28
 * Last modified: 2025-06-28
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Manages the state and interactions of drawers within the application.
 * This class is implemented as a singleton to ensure a consistent state across the application.
 *
 * The DrawerManager is responsible for:
 * - Managing which drawer is currently open
 * - Handling the opening and closing of drawers
 * - Tracking mouse interactions with drawer elements
 * - Supporting tabbed content within drawers
 * - Dispatching custom events when drawers are opened
 *
 * @class PanelManager
 * @singleton
 */
export class PanelManager {
    /**
     * The state of drawers in the application.
     * @type {Object}
     * @property {string|null} open - The ID of the currently open drawer, or null if no drawer is open
     * @property {string|null} action - The current action being performed in the drawer
     */
    drawers = null

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
     * Creates a new instance of DrawerManager or returns the existing instance.
     * Implements the singleton pattern to ensure only one instance exists.
     *
     * @constructor
     */
    constructor() {
        // Check if an instance already exists
        if (PanelManager.instance) {
            return PanelManager.instance
        }

        // Initialize drawers from the main proxy
        this.drawers = lgs.mainProxy.drawers
        PanelManager.instance = this
    }

    /**
     * Gets the currently active tab for the open drawer.
     *
     * @returns {string|undefined} The name of the active tab, or undefined if not set
     */
    get tab() {
        return this.#tabs.get(this.drawers.open)
    }

    /**
     * Sets the active tab for the currently open drawer.
     *
     * @param {string} tab - The name of the tab to set
     */
    set tab(tab) {
        this.#tabs.set(this.drawers.open, tab)
    }

    /**
     * Checks if the specified drawer is currently open.
     *
     * @param {string} id - The ID of the drawer to check
     * @returns {boolean} True if the specified drawer is currently open, false otherwise
     */
    isCurrent = (id) => {
        return this.drawers.open === id
    }

    /**
     * Determines if a drawer can be opened.
     * A drawer can be opened if it is not already the current open drawer.
     *
     * @param {string} id - The ID of the drawer to check
     * @returns {boolean} True if the drawer can be opened, false otherwise
     */
    canOpen = (id) => {
        return !this.isCurrent(id)
    }

    /**
     * Toggles the state of a drawer.
     * Opens the drawer if it is not already open, otherwise closes it.
     *
     * @param {string} id - The ID of the drawer to toggle
     * @param {Object} [options] - Additional options for the toggle operation
     * @param {string} [options.action] - The action to perform when opening the drawer
     * @param {string} [options.entity] - The entity ID associated with the drawer content
     * @param {string} [options.tab] - The tab to activate when opening the drawer
     */
    toggle = (id, options) => {
        // Open the drawer if it can be opened, otherwise close it
        if (this.canOpen(id)) {
            this.open(id, options)
        }
        else {
            this.close()
        }
    }

    /**
     * Opens a specified drawer and configures it with provided options.
     *
     * @param {string} id - The ID of the drawer to open
     * @param {Object} [options] - Additional options for opening the drawer
     * @param {string} [options.action] - The action to perform when opening the drawer
     * @param {string} [options.entity] - The entity ID associated with the drawer content
     * @param {string} [options.tab] - The tab to activate when opening the drawer
     */
    open = (id, options) => {
        // Set the drawer as open and configure the action
        this.drawers.open = id
        this.drawers.action = options?.action ?? ''

        // Handle tab activation if specified or previously set
        if (options?.tab) {
            this.openTab(options.tab)
            this.tab = options.tab
        }
        else if (this.tab) {
            this.openTab(this.tab)
        }
    }

    /**
     * Closes the currently open drawer and removes focus from its active elements.
     */
    close = () => {
        // Remove focus from any active elements within the drawer
        document.activeElement?.blur()
        this.drawers.open = null
    }

    /**
     * Checks if an event's target is a drawer element.
     * Prevents default behavior if the target is not a drawer.
     *
     * @param {Event} event - The event to check
     * @returns {boolean} True if the event target is a drawer, false otherwise
     */
    check = (event) => {
        if (event.target.nodeName !== 'SL-DRAWER') {
            event.preventDefault()
            return false
        }
        return true
    }

    /**
     * Handles mouse leave events on drawer elements.
     * Sets the 'over' property to false when the mouse leaves a drawer.
     *
     * @param {Event} event - The mouse leave event
     */
    mouseLeave = (event) => {
        this.over = false
    }

    /**
     * Handles mouse enter events on drawer elements.
     * Sets the 'over' property to true when the mouse enters a drawer.
     *
     * @param {Event} event - The mouse enter event
     */
    mouseEnter = (event) => {
        this.over = true
    }

    /**
     * Attaches mouse enter, leave, and open event listeners to all drawer elements.
     * Dispatches a custom 'drawer-open' event when a drawer is opened.
     */
    attachEvents = () => {
        // Select all drawer elements and attach event listeners
        document.querySelectorAll('sl-drawer').forEach((drawer) => {
            // Attach mouse interaction handlers
            drawer.addEventListener('mouseleave', this.mouseLeave)
            drawer.addEventListener('mouseenter', this.mouseEnter)

            // Handle drawer open event
            drawer.addEventListener('sl-after-show', () => {
                // Dispatch a custom event when the drawer is shown
                const event = new CustomEvent('drawer-open', {
                    detail:  {drawerId: drawer.id},
                    bubbles: true,
                    composed: true,
                })
                drawer.dispatchEvent(event)
            })

            // Attach tab change listeners to tab groups within the drawer
            const tabgroups = drawer.querySelectorAll('sl-tab-group')
            tabgroups.forEach(tabgroup => {
                tabgroup.addEventListener('sl-tab-show', (event) => {
                    this.tab = event.detail.name
                    console.log('Tab switched to:', event.detail.name)
                })
            })
        })
    }

    /**
     * Resets the drawer manager's action state.
     */
    clean = () => {
        this.drawers.action = null
    }

    /**
     * Opens a specific tab within all tab groups associated with the currently open drawer.
     * If no tabName is provided, uses the tab stored for the current drawer in the tabs Map.
     *
     * @param {string} [tabName] - The name of the tab panel to open within each applicable tab group
     */
    openTab = (tabName) => {
        // Use the stored tab for the current drawer if tabName is not provided
        const activeTab = tabName ?? this.#tabs.get(this.drawers.open)

        // Exit if no valid tab is available
        if (!activeTab) {
            return
        }

        // Find all tab groups within the currently open drawer
        const tabGroups = Array.from(
            document.querySelectorAll(`sl-drawer[id="${this.drawers.open}"] sl-tab-group`),
        )

        // Show the specified or stored tab if it exists in the tab group
        for (const tabGroup of tabGroups) {
            const tab = tabGroup.querySelector(`sl-tab[panel="${activeTab}"]`)
            if (tab) {
                tabGroup.show(activeTab)
            }
        }
    }

    /**
     * Checks if a specific tab exists for the currently open drawer.
     *
     * @param {string} tabName - The name of the tab to check
     * @returns {boolean} True if the tab exists for the currently open drawer, false otherwise
     */
    tabActive = (tabName) => {
        // Return false if no drawer is open
        if (!this.drawers.open) {
            return false
        }

        // Check if the tabName exists in the tabs Map for the current drawer
        return this.#tabs.has(this.drawers.open) &&
            this.#tabs.get(this.drawers.open) === tabName
    }
}