/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-27
 * Last modified: 2025-06-27
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
 * - Dispatching custom events when drawers are closed
 *
 * @class DrawerManager
 */
export class DrawerManager {
    /**
     * The state of drawers in the application
     * @type {Object}
     * @property {string|null} open - ID of the currently open drawer, or null if no drawer is open
     * @property {string|null} action - Current action being performed in the drawer
     */
    drawers = null;

    /**
     * Indicates whether the mouse is currently over a drawer element
     * @type {boolean}
     */
    over = false;

    /**
     * Creates a new instance of DrawerManager or returns the existing instance if one exists.
     * Implements the singleton pattern to ensure only one instance of DrawerManager exists.
     */
    constructor() {
        if (DrawerManager.instance) {
            return DrawerManager.instance
        }

        this.drawers = lgs.mainProxy.drawers
        DrawerManager.instance = this
    }

    /**
     * Checks if the specified drawer is currently open.
     *
     * @param {string} id - The ID of the drawer to check
     * @returns {boolean} True if the specified drawer is currently open, false otherwise
     */
    isCurrent = (id) => {
        return this.drawers.open === id
    };

    /**
     * Determines if a drawer can be opened.
     * A drawer can be opened if it is not already the current open drawer.
     *
     * @param {string} id - The ID of the drawer to check
     * @returns {boolean} True if the drawer can be opened, false otherwise
     */
    canOpen = (id) => {
        return !this.isCurrent(id)
    };

    /**
     * Toggles the state of a drawer.
     * If the drawer is not open, it will be opened.
     * If the drawer is already open, it will be closed.
     *
     * @param {string} id - The ID of the drawer to toggle
     * @param {Object} options - Additional options for the toggle operation
     * @param {string} [options.action] - The action to perform when opening the drawer
     * @param {string} [options.entity] - The entity ID associated with the drawer content
     * @param {string} [options.tab] - The tab to activate when opening the drawer
     */
    toggle = (id, options) => {
        if (this.canOpen(id)) {
            this.open(id, options)
        }
        else {
            this.close()
        }
    };

    /**
     * Opens a specified drawer.
     *
     * @param {string} id - The ID of the drawer to open
     * @param {Object} options - Additional options for opening the drawer
     * @param {string} [options.action] - The action to perform when opening the drawer
     * @param {string} [options.entity] - The entity ID associated with the drawer content
     * @param {string} [options.tab] - The tab to activate when opening the drawer
     */
    open = (id, options) => {
        this.drawers.open = id
        this.drawers.action = options?.action ?? ''
        if (options?.tab) {
            this.openTab(options.tab)
        }
    };

    /**
     * Closes the currently open drawer.
     * Removes focus from any active elements within the drawer.
     */
    close = () => {
        document.activeElement?.blur() // Remove focus on children
        this.drawers.open = null
    };

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
    };

    /**
     * Handles mouse leave events on drawer elements.
     * Sets the 'over' property to false.
     *
     * @param {Event} event - The mouse leave event
     */
    mouseLeave = (event) => {
        this.over = false
    };

    /**
     * Handles mouse enter events on drawer elements.
     * Sets the 'over' property to true.
     *
     * @param {Event} event - The mouse enter event
     */
    mouseEnter = (event) => {
        this.over = true
    };

    /**
     * Attaches mouse enter, leave, and open event listeners to all drawer elements.
     * Dispatches a custom 'drawer-open' event when a drawer is open.
     */
    attachEvents = () => {
        document.querySelectorAll('sl-drawer').forEach((drawer) => {
            drawer.addEventListener('mouseleave', this.mouseLeave)
            drawer.addEventListener('mouseenter', this.mouseEnter)
            drawer.addEventListener('sl-after-show', () => {
                const event = new CustomEvent('drawer-open', {
                    detail:   {drawerId: drawer.id},
                    bubbles:  true,
                    composed: true,
                })

                drawer.dispatchEvent(event)
            })
            console.log(drawer)
        })
    };

    /**
     * Cleans up the drawer manager state.
     * Resets the action property to null.
     */
    clean = () => {
        this.drawers.action = null
    };

    /**
     * Handles opening a specific tab within a set of tab groups associated with the currently open drawer.
     *
     * @param {string} tabName - The name of the tab panel to open within each applicable tab group.
     */
    openTab = (tabName) => {
        const tabGroups = Array.from(document.querySelectorAll(`sl-drawer[id="${this.drawers.open}"] sl-tab-group`))
        for (const tabGroup of tabGroups) {
            const tab = tabGroup.querySelector(`sl-tab[panel="${tabName}"]`)
            if (tab) {
                tabGroup.show(tabName)
            }
        }
    };
}