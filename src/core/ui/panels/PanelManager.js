/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ui } from '../../stores/ui.js'

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
     * Session state for drawers, keyed by drawer id and then by UI group key.
     * @private
     * @type {Map<string, {tabs: Map<string, string>, details: Map<string, boolean>}>}
     */
    #drawerUiState = new Map()

    /**
     * Stack history to manage stacked drawers.
     * @private
     * @type {Array<Object>}
     */
    #stack = []

    #drawerAfterShowAttached = new WeakSet()
    #tabGroupAttached = new WeakSet()
    #detailsAttached = new WeakSet()

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

    #getDrawerState = (drawerId) => {
        if (!this.#drawerUiState.has(drawerId)) {
            this.#drawerUiState.set(drawerId, {
                tabs:    new Map(),
                details: new Map(),
            })
        }

        return this.#drawerUiState.get(drawerId)
    }

    #getDrawerElement = (drawerId) => {
        if (!drawerId || typeof document === 'undefined') {
            return null
        }

        return document.querySelector(`wa-drawer[id="${drawerId}"]`)
    }

    #getGroupKey = (element, selector, fallbackPrefix) => {
        if (!element) {
            return `${fallbackPrefix}:0`
        }

        const explicitKey = element.getAttribute?.('data-ui-state-key')
                         ?? element.id
                         ?? element.getAttribute?.('name')

        if (explicitKey) {
            return explicitKey
        }

        const drawer = element.closest?.('wa-drawer')
        const siblings = drawer ? Array.from(drawer.querySelectorAll(selector)) : []
        const index = siblings.indexOf(element)

        return `${fallbackPrefix}:${index >= 0 ? index : 0}`
    }

    #snapshotDrawerUiState = (drawer) => {
        if (!drawer?.id) {
            return
        }

        const drawerId = drawer.id
        const state = this.#getDrawerState(drawerId)
        const tabGroups = Array.from(drawer.querySelectorAll('wa-tab-group'))
        const detailsGroups = Array.from(drawer.querySelectorAll('wa-details'))

        for (const [index, tabGroup] of tabGroups.entries()) {
            const key = this.#getGroupKey(tabGroup, 'wa-tab-group', `tabgroup:${index}`)
            const activeTab = tabGroup.active ?? tabGroup.getAttribute?.('active') ?? null

            if (activeTab) {
                state.tabs.set(key, activeTab)
                if (!this.#tabs.has(drawerId)) {
                    this.#tabs.set(drawerId, activeTab)
                }
            }
        }

        for (const [index, details] of detailsGroups.entries()) {
            const key = this.#getGroupKey(details, 'wa-details', `details:${index}`)
            state.details.set(key, Boolean(details.open))
        }
    }

    #restoreDrawerTabs = (drawer) => {
        if (!drawer?.id) {
            return
        }

        const drawerId = drawer.id
        const state = this.#drawerUiState.get(drawerId)

        if (!state) {
            return
        }

        const tabGroups = Array.from(drawer.querySelectorAll('wa-tab-group'))
        for (const [index, tabGroup] of tabGroups.entries()) {
            const key = this.#getGroupKey(tabGroup, 'wa-tab-group', `tabgroup:${index}`)
            const activeTab = state.tabs.get(key)
            if (!activeTab) {
                continue
            }

            if (typeof tabGroup.show === 'function') {
                tabGroup.show(activeTab)
            }
            else if (tabGroup.active !== activeTab) {
                tabGroup.active = activeTab
            }
        }
    }

    #restoreDrawerDetails = (drawer) => {
        if (!drawer?.id) {
            return
        }

        const drawerId = drawer.id
        const state = this.#drawerUiState.get(drawerId)

        if (!state) {
            return
        }

        const detailsGroups = Array.from(drawer.querySelectorAll('wa-details'))

        for (const [index, details] of detailsGroups.entries()) {
            const key = this.#getGroupKey(details, 'wa-details', `details:${index}`)
            if (!state.details.has(key)) {
                continue
            }

            const shouldOpen = state.details.get(key)
            const currentOpen = Boolean(details.open)

            if (shouldOpen && !currentOpen) {
                if (typeof details.show === 'function') {
                    details.show()
                }
                else {
                    details.open = true
                }
            }
            else if (!shouldOpen && currentOpen) {
                if (typeof details.hide === 'function') {
                    details.hide()
                }
                else {
                    details.open = false
                }
            }
        }
    }

    #attachDrawerUiStateListeners = (drawer) => {
        if (!drawer) {
            return
        }

        if (!this.#drawerAfterShowAttached.has(drawer)) {
            drawer.addEventListener('wa-after-show', () => {
                const event = new CustomEvent('drawer-open', {
                    detail: {drawerId: drawer.id},
                    bubbles: true,
                    composed: true,
                })
                drawer.dispatchEvent(event)

                requestAnimationFrame(() => {
                    this.#attachDrawerUiStateListeners(drawer)
                    this.#snapshotDrawerUiState(drawer)
                })
            })
            this.#drawerAfterShowAttached.add(drawer)
        }

        Array.from(drawer.querySelectorAll('wa-tab-group')).forEach((tabGroup) => {
            if (this.#tabGroupAttached.has(tabGroup)) {
                return
            }

            tabGroup.addEventListener('wa-tab-show', (event) => {
                const activeTab = event.detail?.name ?? tabGroup.active ?? null
                if (!activeTab) {
                    return
                }

                const drawerId = drawer.id
                const state = this.#getDrawerState(drawerId)
                const key = this.#getGroupKey(tabGroup, 'wa-tab-group', 'tabgroup')
                state.tabs.set(key, activeTab)
                this.#tabs.set(drawerId, activeTab)
            })
            tabGroup.addEventListener('wa-tab-hide', (event) => {
                const activeTab = event.detail?.name ?? tabGroup.active ?? null
                if (!activeTab) {
                    return
                }

                const drawerId = drawer.id
                const state = this.#getDrawerState(drawerId)
                const key = this.#getGroupKey(tabGroup, 'wa-tab-group', 'tabgroup')
                state.tabs.set(key, activeTab)
                this.#tabs.set(drawerId, activeTab)
            })
            this.#tabGroupAttached.add(tabGroup)
        })

        Array.from(drawer.querySelectorAll('wa-details')).forEach((details) => {
            if (this.#detailsAttached.has(details)) {
                return
            }

            const updateDetailsState = () => {
                const drawerId = drawer.id
                const state = this.#getDrawerState(drawerId)
                const key = this.#getGroupKey(details, 'wa-details', 'details')
                state.details.set(key, Boolean(details.open))
            }

            details.addEventListener('wa-show', updateDetailsState)
            details.addEventListener('wa-after-show', updateDetailsState)
            details.addEventListener('wa-hide', updateDetailsState)
            details.addEventListener('wa-after-hide', updateDetailsState)
            this.#detailsAttached.add(details)
        })
    }

    restoreDrawerUiState = (drawer) => {
        if (!drawer) {
            return
        }

        this.#attachDrawerUiStateListeners(drawer)
        this.#restoreDrawerTabs(drawer)
        requestAnimationFrame(() => {
            this.#restoreDrawerDetails(drawer)
            this.#snapshotDrawerUiState(drawer)
        })
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
        ui.drawers.options = options
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
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.openTab(tabToActivate)
                })
            })
        }

        const drawer = this.#getDrawerElement(id)
        if (drawer) {
            const frame = requestAnimationFrame(() => {
                this.restoreDrawerUiState(drawer)
            })

            drawer.__drawerStateOpenFrame = frame
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

            const drawer = this.#getDrawerElement(previous.id)
            if (drawer) {
                const frame = requestAnimationFrame(() => {
                    this.restoreDrawerUiState(drawer)
                })

                drawer.__drawerStateRestoreFrame = frame
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
            this.#attachDrawerUiStateListeners(drawer)
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

        const drawer = this.#getDrawerElement(this.drawers.open)
        if (drawer) {
            this.#snapshotDrawerUiState(drawer)
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
