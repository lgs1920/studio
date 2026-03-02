/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ContextMenu.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Global singleton that manages the single floating context menu.
 * Framework-agnostic – only manipulates DOM directly (top/left + CSS class).
 */
export class ContextMenu {
    /** Singleton instance */
    static #instance

    /** Distance in pixels between cursor and menu */
    static MENU_OFFSET = 10

    /** Root element of the context menu */
    #menuElement = null

    /** Event current target */
    #target = null

    /** Current visibility state */
    #isVisible = false

    constructor() {
        if (ContextMenu.#instance) {
            return ContextMenu.#instance
        }
        ContextMenu.#instance = this
        this.#bindGlobalEvents()
    }

    /** Attach global click-outside listener */
    #bindGlobalEvents = () => {
        document.addEventListener('pointerdown', this.#handleClickOutside)
    }

    /** Close menu when clicking outside */
    #handleClickOutside = (event) => {
        if (this.#isVisible && this.#menuElement && !this.#menuElement.contains(event.target)) {
            this.hide()
        }
    }

    /** Compute best position inside viewport with flip logic */
    #updatePosition = (cursorX, cursorY) => {
        const rect = this.#menuElement.getBoundingClientRect()
        const offset = ContextMenu.MENU_OFFSET
        const {innerWidth, innerHeight} = window

        let top = cursorY + offset
        let left = cursorX + offset

        // Flip vertically if needed
        if (top + rect.height + offset > innerHeight) {
            top = innerHeight - rect.height - offset
        }
        // Flip horizontally if needed
        if (left + rect.width + offset > innerWidth) {
            left = innerWidth - rect.width - offset
        }

        // Clamp to viewport
        top = Math.max(offset, Math.min(top, innerHeight - rect.height - offset))
        left = Math.max(offset, Math.min(left, innerWidth - rect.width - offset))

        this.#menuElement.style.top = `${top}px`
        this.#menuElement.style.left = `${left}px`
    }

    /**
     * Initialize the singleton with the actual DOM element.
     * Must be called once before any showAt/hide usage.
     *
     * @param {HTMLElement} element - Root element of the context menu
     */
    initialize = (element = null) => {

        if (!(element instanceof HTMLElement)) {
            throw new Error('ContextMenu.initialize() expects a valid HTMLElement')
        }
        this.#menuElement = element
        if (!element.classList.contains('lgs-context-menu')) {
            element.classList.add('lgs-context-menu')
        }
        this.hide()
    }

    /**
     * Show the menu at the given coordinates.
     *
     * @param {{x: number, y: number}} position - Cursor position
     */
    showAt = ({x, y}) => {
        if (!this.#menuElement) {
            return
        }

        this.#updatePosition(x, y)
        this.#menuElement.classList.add('visible', true)
        this.#menuElement.style.pointerEvents = 'all'
        this.#isVisible = true
    }

    /** Hide the menu */
    hide = () => {
        if (this.#menuElement) {
            this.#menuElement.classList.remove('visible', false)
            this.#menuElement.style.pointerEvents = 'none'
            this.#isVisible = false
        }
        this.#target = null
    }

    /** Cleanup listeners and reset internal state */
    destroy = () => {
        document.removeEventListener('pointerdown', this.#handleClickOutside)
        this.#menuElement = null
        this.#isVisible = false
        ContextMenu.#instance = null
    }
}